import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { TicketCheck, MapPin, Calendar, Clock, Users, ChevronRight, X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';

interface Reservation {
  id: string;
  booking_reference: string;
  passenger_name: string;
  passenger_phone: string;
  seat_numbers: string[];
  total_seats: number;
  total_price: number;
  status: string;
  payment_status: string;
  qr_code: string;
  created_at: string;
  schedules: {
    departure_datetime: string;
    arrival_datetime: string;
    status: string;
    routes: {
      base_price: number;
      distance_km: number;
      origin_station: { name: string; city_id: string };
      destination_station: { name: string; city_id: string };
    };
    buses: {
      registration_number: string;
      seat_configs: { class_type: string };
    };
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'En attente', color: '#92400e', bg: '#fef3c7' },
  confirmed: { label: 'Confirmée', color: '#065f46', bg: '#d1fae5' },
  paid: { label: 'Payée', color: '#1e40af', bg: '#dbeafe' },
  embarked: { label: 'Embarquée', color: '#5b21b6', bg: '#ede9fe' },
  cancelled: { label: 'Annulée', color: '#991b1b', bg: '#fee2e2' },
  completed: { label: 'Terminée', color: '#374151', bg: '#f3f4f6' },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'Toutes' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'paid', label: 'Payées' },
  { value: 'completed', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
];

export default function ClientReservations() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user) loadReservations();
  }, [user]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, booking_reference, passenger_name, passenger_phone,
          seat_numbers, total_seats, total_price, status, payment_status,
          qr_code, created_at,
          schedules:schedule_id (
            departure_datetime, arrival_datetime, status,
            routes:route_id (
              base_price, distance_km,
              origin_station:stations!origin_station_id(name, city_id),
              destination_station:stations!destination_station_id(name, city_id)
            ),
            buses:bus_id (
              registration_number,
              seat_configs:seat_config_id(class_type)
            )
          )
        `)
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReservations((data || []) as unknown as Reservation[]);
    } catch (error: any) {
      toast.error('Erreur de chargement des réservations');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reservation: Reservation) => {
    if (!confirm('Confirmer l\'annulation de cette réservation ?')) return;
    try {
      setCancelling(true);
      const { error } = await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', reservation.id);
      if (error) throw error;
      toast.success('Réservation annulée');
      setSelected(null);
      loadReservations();
    } catch {
      toast.error('Erreur lors de l\'annulation');
    } finally {
      setCancelling(false);
    }
  };

  const filtered = filter === 'all' ? reservations : reservations.filter(r => r.status === filter);

  const upcoming = reservations.filter(r =>
    ['confirmed', 'paid'].includes(r.status) &&
    new Date(r.schedules?.departure_datetime) > new Date()
  ).length;

  const total = reservations.length;
  const totalSpent = reservations
    .filter(r => ['paid', 'completed', 'embarked'].includes(r.status))
    .reduce((sum, r) => sum + Number(r.total_price), 0);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
          <TicketCheck className="w-8 h-8" style={{ color: 'var(--primary)' }} />
          Mes Réservations
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Consultez et gérez vos billets de voyage
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total réservations', value: total, sub: 'depuis votre inscription' },
          { label: 'Voyages à venir', value: upcoming, sub: 'confirmés ou payés' },
          { label: 'Total dépensé', value: formatCurrency(totalSpent), sub: 'billets payés' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl p-5 border" style={{ backgroundColor: 'var(--surface)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-colors border"
            style={{
              backgroundColor: filter === opt.value ? 'var(--primary)' : 'var(--surface)',
              color: filter === opt.value ? 'var(--text-on-primary)' : 'var(--text-secondary)',
              borderColor: filter === opt.value ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border p-16 text-center" style={{ backgroundColor: 'var(--surface)' }}>
          <TicketCheck className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Aucune réservation trouvée
          </p>
          <p style={{ color: 'var(--text-secondary)' }}>
            {filter === 'all' ? 'Vous n\'avez pas encore effectué de réservation.' : 'Aucune réservation avec ce statut.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(reservation => {
            const schedule = reservation.schedules;
            const route = schedule?.routes;
            const statusInfo = STATUS_LABELS[reservation.status] || STATUS_LABELS.pending;
            const depDate = schedule?.departure_datetime ? new Date(schedule.departure_datetime) : null;
            const isPast = depDate ? depDate < new Date() : false;
            const canCancel = ['pending', 'confirmed'].includes(reservation.status) && !isPast;

            return (
              <div
                key={reservation.id}
                className="rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                style={{ backgroundColor: 'var(--surface)' }}
                onClick={() => setSelected(reservation)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold px-3 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {reservation.booking_reference}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 rounded-full"
                        style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      {route?.origin_station && (
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: 'var(--neutral-100)', color: 'var(--text-secondary)' }}>
                          {schedule?.buses?.seat_configs?.class_type || 'Standard'}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                  </div>

                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route?.origin_station?.name || '—'}
                      </span>
                    </div>
                    <div className="flex-1 border-t border-dashed" style={{ borderColor: 'var(--border)' }} />
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {route?.destination_station?.name || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {depDate && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>{format(depDate, 'dd MMM yyyy', { locale: fr })}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          <span>{format(depDate, 'HH:mm')}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{reservation.total_seats} place{reservation.total_seats > 1 ? 's' : ''}</span>
                    </div>
                    <span className="ml-auto font-bold text-base" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(Number(reservation.total_price))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Détails du billet
              </h2>
              <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center p-4 rounded-xl" style={{ backgroundColor: 'var(--primary-light)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--primary)' }}>Référence de réservation</p>
                <p className="text-2xl font-mono font-bold" style={{ color: 'var(--primary)' }}>
                  {selected.booking_reference}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Départ</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {selected.schedules?.routes?.origin_station?.name}
                  </p>
                  {selected.schedules?.departure_datetime && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(selected.schedules.departure_datetime), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Arrivée</p>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {selected.schedules?.routes?.destination_station?.name}
                  </p>
                  {selected.schedules?.arrival_datetime && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {format(new Date(selected.schedules.arrival_datetime), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>

              <div className="border rounded-xl p-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
                {[
                  { label: 'Passager', value: selected.passenger_name },
                  { label: 'Téléphone', value: selected.passenger_phone },
                  { label: 'Sièges', value: selected.seat_numbers?.join(', ') || '—' },
                  { label: 'Classe', value: selected.schedules?.buses?.seat_configs?.class_type || 'Standard' },
                  { label: 'Bus', value: selected.schedules?.buses?.registration_number || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Montant total</span>
                  <span className="font-bold text-base" style={{ color: 'var(--primary)' }}>
                    {formatCurrency(Number(selected.total_price))}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs px-3 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: (STATUS_LABELS[selected.status] || STATUS_LABELS.pending).bg,
                    color: (STATUS_LABELS[selected.status] || STATUS_LABELS.pending).color,
                  }}>
                  {(STATUS_LABELS[selected.status] || STATUS_LABELS.pending).label}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Réservé le {format(new Date(selected.created_at), 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              {['pending', 'confirmed'].includes(selected.status) &&
                selected.schedules?.departure_datetime &&
                new Date(selected.schedules.departure_datetime) > new Date() && (
                  <button
                    onClick={() => handleCancel(selected)}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl border font-medium text-sm transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    {cancelling ? 'Annulation...' : 'Annuler la réservation'}
                  </button>
                )}
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 rounded-xl font-medium text-sm"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--text-on-primary)' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
