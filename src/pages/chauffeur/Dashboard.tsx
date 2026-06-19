import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Calendar, MapPin, FileText, Fuel, AlertTriangle, Clock, Bus, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { calculateDriverHours } from '../../utils/driverHoursCalc';
import PerformanceBadge from '../../components/driver/PerformanceBadge';

interface NextTrip {
  id: string;
  route_name: string;
  departure_datetime: string;
  departure_stations: { name: string; dock_number?: string } | null;
  arrival_stations: { name: string } | null;
  buses: { registration_number: string; model: string; brand?: string } | null;
  has_pending_voucher: boolean;
}

interface DriverHours {
  todayHours: number;
  todayMax: number;
  weekHours: number;
  weekMax: number;
  todayPercent: number;
  weekPercent: number;
}

export default function ChauffeurDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nextTrip, setNextTrip] = useState<NextTrip | null>(null);
  const [hours, setHours] = useState<DriverHours>({
    todayHours: 0,
    todayMax: 9,
    weekHours: 0,
    weekMax: 48,
    todayPercent: 0,
    weekPercent: 0
  });

  useEffect(() => {
    if (user?.id) loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      await Promise.all([loadNextTrip(), loadDriverHours()]);
    } catch (error: any) {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const loadNextTrip = async () => {
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          route_name,
          departure_datetime,
          departure_stations:departure_station_id (name, dock_number),
          arrival_stations:arrival_station_id (name),
          buses:bus_id (registration_number, model, brand)
        `)
        .eq('driver_id', user?.id)
        .gte('departure_datetime', new Date().toISOString())
        .in('status', ['scheduled', 'planifie'])
        .order('departure_datetime', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const { data: voucherCheck } = await supabase
          .from('fuel_vouchers')
          .select('id')
          .eq('schedule_id', data.id)
          .in('status', ['pending_refuel', 'genere'])
          .maybeSingle();

        setNextTrip({
          ...data,
          has_pending_voucher: !!voucherCheck
        } as NextTrip);
      }
    } catch (error: any) {
      console.error('Erreur chargement prochain voyage:', error);
    }
  };

  const loadDriverHours = async () => {
    try {
      const result = await calculateDriverHours(user?.id || '');
      setHours({
        ...result,
        todayPercent: (result.todayHours / result.todayMax) * 100,
        weekPercent: (result.weekHours / result.weekMax) * 100,
      });
    } catch (error: any) {
      console.error('Erreur calcul heures:', error);
    }
  };

  const getHoursColor = (percent: number) => {
    if (percent >= 90) return '#AF3029';
    if (percent >= 75) return '#F59E0B';
    return '#0B7439';
  };

  const getHoursLabel = (percent: number) => {
    if (percent >= 90) return 'Limite atteinte';
    if (percent >= 75) return 'Attention';
    return 'Normal';
  };

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: 'var(--bg-subtle)' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Bonjour, {user?.full_name?.split(' ')[0] || 'Chauffeur'}
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 rounded-full animate-spin mx-auto mb-4"
                 style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Next Trip */}
            <div className="bg-white rounded-xl p-6 border-2"
                 style={{ borderColor: nextTrip ? 'var(--primary)' : 'var(--border)' }}>
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                MON PROCHAIN VOYAGE
              </h2>

              {nextTrip ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>DATE & HEURE</p>
                      <p className="text-xl font-bold">
                        {format(new Date(nextTrip.departure_datetime), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>
                        {format(new Date(nextTrip.departure_datetime), 'HH:mm')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>TRAJET</p>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                        <p className="font-bold">{nextTrip.route_name}</p>
                      </div>
                      {nextTrip.departure_stations && nextTrip.arrival_stations && (
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {nextTrip.departure_stations.name} → {nextTrip.arrival_stations.name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nextTrip.buses && (
                      <div>
                        <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>BUS</p>
                        <div className="flex items-center gap-2">
                          <Bus className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          <div>
                            <p className="text-lg font-bold">{nextTrip.buses.registration_number}</p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {nextTrip.buses.brand} {nextTrip.buses.model}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {nextTrip.departure_stations?.dock_number && (
                      <div>
                        <p className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>QUAI</p>
                        <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>
                          {nextTrip.departure_stations.dock_number}
                        </p>
                      </div>
                    )}
                  </div>

                  {nextTrip.has_pending_voucher && (
                    <button
                      onClick={() => navigate('/chauffeur/fuel-vouchers')}
                      className="w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                      style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}
                    >
                      <Fuel className="w-5 h-5" />
                      Bon de carburant en attente — Remplir maintenant
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p style={{ color: 'var(--text-secondary)' }}>Aucun voyage planifié à venir</p>
                </div>
              )}
            </div>

            {/* Hours tracker */}
            <div className="bg-white rounded-xl p-6 border">
              <h2 className="font-bold text-lg mb-5 flex items-center gap-2">
                <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                MES HEURES DE CONDUITE
              </h2>
              <div className="space-y-5">
                {[
                  { label: "Aujourd'hui", hours: hours.todayHours, max: hours.todayMax, pct: hours.todayPercent },
                  { label: 'Cette semaine', hours: hours.weekHours, max: hours.weekMax, pct: hours.weekPercent },
                ].map(({ label, hours: h, max, pct }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{label}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-bold tabular-nums">
                          {Math.floor(h)}h{String(Math.round((h % 1) * 60)).padStart(2, '0')}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>/ {max}h</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: getHoursColor(pct) + '20', color: getHoursColor(pct) }}
                        >
                          {getHoursLabel(pct)}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="absolute h-full transition-all rounded-full"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: getHoursColor(pct) }}
                      />
                    </div>
                    <p className="text-xs mt-1 text-right font-medium" style={{ color: getHoursColor(pct) }}>
                      {pct.toFixed(0)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance badge */}
            <PerformanceBadge driverId={user?.id || ''} />

            {/* Quick actions */}
            <div className="bg-white rounded-xl p-6 border">
              <h2 className="font-bold text-lg mb-4">ACTIONS RAPIDES</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    path: '/chauffeur/trips',
                    icon: <FileText className="w-5 h-5" />,
                    label: 'Mes voyages',
                    desc: 'Historique et planning',
                    iconBg: 'var(--primary-light)',
                    iconColor: 'var(--primary)',
                  },
                  {
                    path: '/chauffeur/fuel-vouchers',
                    icon: <Fuel className="w-5 h-5" />,
                    label: 'Bons carburant',
                    desc: 'Créer et consulter',
                    iconBg: 'var(--warning-light)',
                    iconColor: 'var(--warning)',
                  },
                  {
                    path: '/chauffeur/breakdown',
                    icon: <AlertTriangle className="w-5 h-5" />,
                    label: 'Signaler une panne',
                    desc: 'Alerte immédiate',
                    iconBg: 'var(--danger-light)',
                    iconColor: 'var(--danger)',
                  },
                  {
                    path: '/chauffeur/my-breakdowns',
                    icon: <ClipboardList className="w-5 h-5" />,
                    label: 'Mes pannes',
                    desc: 'Historique des signalements',
                    iconBg: '#F3F4F6',
                    iconColor: '#6B7280',
                  },
                ].map(({ path, icon, label, desc, iconBg, iconColor }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="p-4 rounded-xl border-2 hover:shadow-md transition-all text-left"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                         style={{ backgroundColor: iconBg, color: iconColor }}>
                      {icon}
                    </div>
                    <p className="font-bold mb-0.5">{label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
