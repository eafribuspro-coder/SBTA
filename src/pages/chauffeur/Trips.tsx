import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import {
  Calendar, MapPin, Bus, Clock, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, XCircle, Loader2
} from 'lucide-react';
import { format, isAfter, isBefore, startOfToday } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Trip {
  id: string;
  departure_datetime: string;
  arrival_datetime: string | null;
  status: string;
  route_name: string;
  departure_stations: { name: string } | null;
  arrival_stations: { name: string } | null;
  buses: { registration_number: string; model: string; brand?: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  scheduled: { label: 'Planifié', color: 'var(--primary)', bg: 'var(--primary-light)', icon: <Calendar className="w-4 h-4" /> },
  planifie: { label: 'Planifié', color: 'var(--primary)', bg: 'var(--primary-light)', icon: <Calendar className="w-4 h-4" /> },
  in_progress: { label: 'En cours', color: '#F59E0B', bg: '#FEF3C7', icon: <Loader2 className="w-4 h-4" /> },
  en_cours: { label: 'En cours', color: '#F59E0B', bg: '#FEF3C7', icon: <Loader2 className="w-4 h-4" /> },
  completed: { label: 'Terminé', color: 'var(--success)', bg: 'var(--success-light)', icon: <CheckCircle className="w-4 h-4" /> },
  termine: { label: 'Terminé', color: 'var(--success)', bg: 'var(--success-light)', icon: <CheckCircle className="w-4 h-4" /> },
  delayed: { label: 'Retardé', color: '#F59E0B', bg: '#FEF3C7', icon: <AlertTriangle className="w-4 h-4" /> },
  cancelled: { label: 'Annulé', color: 'var(--danger)', bg: 'var(--danger-light)', icon: <XCircle className="w-4 h-4" /> },
  annule: { label: 'Annulé', color: 'var(--danger)', bg: 'var(--danger-light)', icon: <XCircle className="w-4 h-4" /> },
};

type FilterTab = 'upcoming' | 'past' | 'all';

const UPCOMING_STATUSES = ['scheduled', 'planifie', 'in_progress', 'en_cours', 'delayed'];

export default function ChauffeurTrips() {
  const { user } = useAuthStore();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('upcoming');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) loadTrips();
  }, [user]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          departure_datetime,
          arrival_datetime,
          status,
          route_name,
          departure_stations:departure_station_id (name),
          arrival_stations:arrival_station_id (name),
          buses:bus_id (registration_number, model, brand)
        `)
        .eq('driver_id', user?.id)
        .order('departure_datetime', { ascending: false });

      if (error) throw error;
      setTrips((data || []) as Trip[]);
    } catch (error: any) {
      toast.error('Erreur de chargement des voyages');
    } finally {
      setLoading(false);
    }
  };

  const today = startOfToday();

  const isUpcoming = (trip: Trip) => UPCOMING_STATUSES.includes(trip.status);
  const isPast = (trip: Trip) => !UPCOMING_STATUSES.includes(trip.status);

  const filteredTrips = trips.filter(trip => {
    if (filter === 'upcoming') return isUpcoming(trip);
    if (filter === 'past') return isPast(trip);
    return true;
  });

  const upcomingCount = trips.filter(isUpcoming).length;
  const pastCount = trips.filter(isPast).length;

  const getStatusCfg = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          Mes voyages
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          {trips.length} voyage{trips.length > 1 ? 's' : ''} au total
        </p>
      </div>

      <div className="flex gap-2 mb-6 p-1 rounded-xl border" style={{ backgroundColor: 'var(--neutral-100)' }}>
        {([
          { key: 'upcoming', label: `A venir (${upcomingCount})` },
          { key: 'past', label: `Historique (${pastCount})` },
          { key: 'all', label: `Tous (${trips.length})` },
        ] as { key: FilterTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: filter === tab.key ? 'white' : 'transparent',
              color: filter === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
              boxShadow: filter === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
               style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Aucun voyage trouvé</p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {filter === 'upcoming' ? 'Pas de voyage planifié' : 'Pas de voyage passé'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map(trip => {
            const cfg = getStatusCfg(trip.status);
            const isExpanded = expandedId === trip.id;
            const depDate = new Date(trip.departure_datetime);

            return (
              <div key={trip.id} className="bg-white rounded-xl border overflow-hidden transition-all">
                <button
                  className="w-full p-5 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : trip.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                           style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {trip.route_name || 'Trajet'}
                          </p>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(depDate, 'EEE d MMM', { locale: fr })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(depDate, 'HH:mm')}
                          </span>
                          {trip.buses && (
                            <span className="flex items-center gap-1">
                              <Bus className="w-3.5 h-3.5" />
                              {trip.buses.registration_number}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                      : <ChevronDown className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-5 pb-5 pt-4" style={{ backgroundColor: 'var(--neutral-50)' }}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Départ</p>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                          <div>
                            <p className="font-semibold text-sm">
                              {trip.departure_stations?.name || '—'}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {format(depDate, 'dd/MM/yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Arrivée</p>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                          <div>
                            <p className="font-semibold text-sm">
                              {trip.arrival_stations?.name || '—'}
                            </p>
                            {trip.arrival_datetime && (
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {format(new Date(trip.arrival_datetime), 'dd/MM/yyyy HH:mm')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {trip.buses && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Bus</p>
                          <div className="flex items-start gap-1.5">
                            <Bus className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
                            <div>
                              <p className="font-semibold text-sm">{trip.buses.registration_number}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {trip.buses.brand} {trip.buses.model}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
