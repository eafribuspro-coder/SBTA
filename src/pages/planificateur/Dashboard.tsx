import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar as CalendarIcon, Bus, Users, Plus, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { formatHours } from '../../services/scheduleValidation';

moment.locale('fr');
const localizer = momentLocalizer(moment);

interface BusItem {
  id: string;
  registration_number: string;
  model: string | null;
  brand: string | null;
  status: string;
  next_departure?: string | null;
}

interface DriverItem {
  id: string;
  full_name: string;
  weekHoursRemaining: number;
  todayHoursRemaining: number;
  hasAlert: boolean;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: any;
}

const BUS_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  disponible:         { label: 'Disponible',        color: '#22C55E', bg: '#F0FDF4' },
  en_service:         { label: 'En service',         color: '#3B82F6', bg: '#EFF6FF' },
  maintenance:        { label: 'Maintenance',        color: '#F59E0B', bg: '#FFFBEB' },
  panne_route:        { label: 'Panne route',        color: '#EF4444', bg: '#FEF2F2' },
  reception_garage:   { label: 'Garage',             color: '#8B5CF6', bg: '#F5F3FF' },
  diagnostic:         { label: 'Diagnostic',         color: '#F59E0B', bg: '#FFFBEB' },
  attente_ot:         { label: 'Attente OT',         color: '#F59E0B', bg: '#FFFBEB' },
  controle_qualite:   { label: 'Contrôle qualité',  color: '#8B5CF6', bg: '#F5F3FF' },
  hors_service:       { label: 'Hors service',       color: '#EF4444', bg: '#FEF2F2' },
};

export default function PlanificateurDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [buses, setBuses] = useState<BusItem[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadSchedules(),
        loadBusAvailability(),
        loadDriverAvailability(),
      ]);
    } catch (error: any) {
      toast.error('Erreur de chargement');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadSchedules = async () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        id,
        route_name,
        departure_datetime,
        arrival_datetime,
        buses:bus_id(registration_number),
        driver:driver_id(full_name)
      `)
      .gte('departure_datetime', weekStart.toISOString())
      .lte('departure_datetime', weekEnd.toISOString())
      .order('departure_datetime', { ascending: true });

    if (error) throw error;

    const calendarEvents: CalendarEvent[] = (data || []).map((s: any) => ({
      id: s.id,
      title: `${s.buses?.registration_number || 'Bus'} — ${s.route_name || 'Voyage'}`,
      start: new Date(s.departure_datetime),
      end: new Date(s.arrival_datetime),
      resource: s,
    }));

    setEvents(calendarEvents);
  };

  const loadBusAvailability = async () => {
    const { data, error } = await supabase
      .from('buses')
      .select('id, registration_number, model, brand, status')
      .eq('is_active', true)
      .order('registration_number');

    if (error) throw error;

    const busesWithNext = await Promise.all(
      (data || []).map(async (bus) => {
        const { data: next } = await supabase
          .from('schedules')
          .select('departure_datetime')
          .eq('bus_id', bus.id)
          .gte('departure_datetime', new Date().toISOString())
          .order('departure_datetime', { ascending: true })
          .limit(1)
          .maybeSingle();

        return { ...bus, next_departure: next?.departure_datetime ?? null };
      })
    );

    setBuses(busesWithNext);
  };

  const loadDriverAvailability = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'chauffeur')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const driversWithHours = await Promise.all(
      (data || []).map(async (driver) => {
        const [{ data: todaySchedules }, { data: weekSchedules }] = await Promise.all([
          supabase
            .from('schedules')
            .select('departure_datetime, arrival_datetime')
            .or(`driver_id.eq.${driver.id},copilot_id.eq.${driver.id}`)
            .gte('departure_datetime', todayStart.toISOString())
            .lte('departure_datetime', todayEnd.toISOString()),
          supabase
            .from('schedules')
            .select('departure_datetime, arrival_datetime')
            .or(`driver_id.eq.${driver.id},copilot_id.eq.${driver.id}`)
            .gte('departure_datetime', weekStart.toISOString())
            .lte('departure_datetime', weekEnd.toISOString()),
        ]);

        const calcHours = (schedules: any[]) =>
          schedules.reduce((sum, s) => {
            const diff = (new Date(s.arrival_datetime).getTime() - new Date(s.departure_datetime).getTime()) / 3600000;
            return sum + diff;
          }, 0);

        const todayHours = calcHours(todaySchedules || []);
        const weekHours = calcHours(weekSchedules || []);
        const todayRemaining = Math.max(0, 9 - todayHours);
        const weekRemaining = Math.max(0, 48 - weekHours);

        return {
          id: driver.id,
          full_name: driver.full_name,
          todayHoursRemaining: todayRemaining,
          weekHoursRemaining: weekRemaining,
          hasAlert: weekRemaining < 10 || todayRemaining < 2,
        };
      })
    );

    setDrivers(driversWithHours);
  };

  const getBusStatusBadge = (status: string) => {
    const cfg = BUS_STATUS_MAP[status] || { label: status, color: '#6B7280', bg: '#F9FAFB' };
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    );
  };

  const eventStyleGetter = () => ({
    style: {
      backgroundColor: 'var(--primary, #0B7439)',
      borderRadius: '4px',
      opacity: 0.9,
      color: 'white',
      border: 'none',
      fontSize: '12px',
      padding: '2px 4px',
    },
  });

  const disponibleCount = buses.filter(b => b.status === 'disponible').length;
  const alertDriverCount = drivers.filter(d => d.hasAlert).length;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Dashboard Planificateur
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gestion des voyages et disponibilités
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            className="p-2 rounded-lg border flex items-center gap-2 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/planificateur/calendar')}
            className="px-4 py-2.5 rounded-lg border font-medium text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Calendrier
          </button>
          <button
            onClick={() => navigate('/planificateur/schedules/new')}
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 shadow-sm"
            style={{ backgroundColor: 'var(--primary)', color: 'white' }}
          >
            <Plus className="w-5 h-5" />
            Créer un voyage
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Voyages cette semaine', value: events.length, color: 'var(--primary)', bg: 'var(--primary-light, #E8F5E9)' },
              { label: 'Bus disponibles', value: disponibleCount, color: '#22C55E', bg: '#F0FDF4' },
              { label: 'Chauffeurs actifs', value: drivers.length, color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Alertes heures', value: alertDriverCount, color: '#F59E0B', bg: '#FFFBEB' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border p-4"
                   style={{ backgroundColor: stat.bg, borderColor: stat.color + '30' }}>
                <p className="text-xs font-medium mb-1" style={{ color: stat.color }}>{stat.label}</p>
                <p className="text-3xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-6 border"
               style={{ backgroundColor: 'var(--surface, white)', borderColor: 'var(--border)' }}>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}>
              <CalendarIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              Calendrier des voyages — semaine en cours
            </h2>
            <div style={{ height: '500px' }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                defaultView="week"
                views={['week', 'day', 'agenda']}
                date={currentDate}
                onNavigate={setCurrentDate}
                eventPropGetter={eventStyleGetter}
                onSelectEvent={(event) => navigate('/planificateur/calendar')}
                onSelectSlot={({ start }) => navigate('/planificateur/schedules/new', { state: { defaultDate: start } })}
                selectable
                messages={{
                  week: 'Semaine',
                  day: 'Jour',
                  agenda: 'Liste',
                  today: "Aujourd'hui",
                  previous: 'Précédent',
                  next: 'Suivant',
                  noEventsInRange: 'Aucun voyage dans cette période',
                  showMore: (total) => `+ ${total} voyage(s)`,
                  date: 'Date',
                  time: 'Heure',
                  event: 'Événement',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border"
                 style={{ backgroundColor: 'var(--surface, white)', borderColor: 'var(--border)' }}>
              <div className="p-5 border-b flex items-center justify-between"
                   style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-bold text-lg flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}>
                  <Bus className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  Disponibilité des bus
                </h2>
                <span className="text-sm font-semibold" style={{ color: '#22C55E' }}>
                  {disponibleCount} / {buses.length} disponibles
                </span>
              </div>
              <div className="p-5 max-h-96 overflow-y-auto space-y-3">
                {buses.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Aucun bus enregistré
                  </p>
                ) : (
                  buses.map(bus => (
                    <div key={bus.id} className="p-4 rounded-lg border"
                         style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {bus.registration_number}
                          </p>
                          {(bus.brand || bus.model) && (
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {[bus.brand, bus.model].filter(Boolean).join(' ')}
                            </p>
                          )}
                        </div>
                        {getBusStatusBadge(bus.status)}
                      </div>
                      {bus.next_departure && (
                        <div className="mt-2 px-3 py-1.5 rounded-lg"
                             style={{ backgroundColor: 'var(--bg-subtle, #F9FAFB)' }}>
                          <p className="text-xs flex items-center gap-1"
                             style={{ color: 'var(--text-secondary)' }}>
                            <Clock className="w-3 h-3" />
                            Prochain départ : {format(new Date(bus.next_departure), 'dd/MM à HH:mm', { locale: fr })}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border"
                 style={{ backgroundColor: 'var(--surface, white)', borderColor: 'var(--border)' }}>
              <div className="p-5 border-b flex items-center justify-between"
                   style={{ borderColor: 'var(--border)' }}>
                <h2 className="font-bold text-lg flex items-center gap-2"
                    style={{ color: 'var(--text-primary)' }}>
                  <Users className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  Disponibilité des chauffeurs
                </h2>
                {alertDriverCount > 0 && (
                  <span className="flex items-center gap-1 text-sm font-semibold"
                        style={{ color: '#F59E0B' }}>
                    <AlertTriangle className="w-4 h-4" />
                    {alertDriverCount} alerte{alertDriverCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="p-5 max-h-96 overflow-y-auto space-y-3">
                {drivers.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Aucun chauffeur enregistré
                  </p>
                ) : (
                  drivers.map(driver => (
                    <div key={driver.id}
                         className="p-4 rounded-lg border-2"
                         style={{
                           borderColor: driver.hasAlert ? '#FDE68A' : 'var(--border)',
                           backgroundColor: driver.hasAlert ? '#FFFBEB' : 'transparent',
                         }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          {driver.full_name}
                        </p>
                        {driver.hasAlert && (
                          <AlertTriangle className="w-5 h-5" style={{ color: '#F59E0B' }} />
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: 'var(--text-secondary)' }}>Aujourd'hui restant :</span>
                          <span className="font-bold"
                                style={{ color: driver.todayHoursRemaining < 2 ? '#EF4444' : '#22C55E' }}>
                            {formatHours(driver.todayHoursRemaining)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{
                                 width: `${Math.min(100, (driver.todayHoursRemaining / 9) * 100)}%`,
                                 backgroundColor: driver.todayHoursRemaining < 2 ? '#EF4444' : '#22C55E',
                               }} />
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: 'var(--text-secondary)' }}>Semaine restant :</span>
                          <span className="font-bold"
                                style={{ color: driver.weekHoursRemaining < 10 ? '#EF4444' : '#22C55E' }}>
                            {formatHours(driver.weekHoursRemaining)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{
                                 width: `${Math.min(100, (driver.weekHoursRemaining / 48) * 100)}%`,
                                 backgroundColor: driver.weekHoursRemaining < 10 ? '#EF4444' : '#22C55E',
                               }} />
                        </div>
                      </div>
                      {driver.hasAlert && (
                        <p className="text-xs font-semibold mt-2" style={{ color: '#F59E0B' }}>
                          Repos obligatoire recommandé
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
