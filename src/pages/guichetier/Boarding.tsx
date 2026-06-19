import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, MapPin, Calendar, Bus, AlertTriangle, ChevronRight, User, Phone, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatCurrency } from '../../utils/formatCurrency';
import { QRCodeSVG } from 'qrcode.react';

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
  schedules: {
    id: string;
    departure_datetime: string;
    arrival_datetime: string;
    route_name: string;
    departure_station: { name: string; city: { name: string } };
    arrival_station: { name: string; city: { name: string } };
    buses: { registration_number: string };
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En attente', color: 'var(--warning)' },
  confirmee: { label: 'Confirmée', color: 'var(--primary)' },
  annulee: { label: 'Annulée', color: 'var(--danger)' },
  terminee: { label: 'Terminée', color: 'var(--success)' },
  embarquee: { label: 'Embarquée', color: 'var(--info)' },
};

export default function Boarding() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Veuillez saisir une référence de réservation');
      return;
    }

    try {
      setSearching(true);
      setReservation(null);

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, booking_reference, passenger_name, passenger_phone,
          seat_numbers, total_seats, total_price, status, payment_status,
          schedules:schedule_id (
            id, departure_datetime, arrival_datetime, route_name,
            departure_station:departure_station_id(name, city:city_id(name)),
            arrival_station:arrival_station_id(name, city:city_id(name)),
            buses:bus_id(registration_number)
          )
        `)
        .eq('booking_reference', searchTerm.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Réservation introuvable');
        return;
      }

      setReservation(data as Reservation);
      toast.success('Réservation trouvée');
    } catch (error: any) {
      toast.error('Erreur lors de la recherche');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleValidateBoarding = async () => {
    if (!reservation) return;

    if (reservation.status === 'annulee') {
      toast.error('Cette réservation a été annulée');
      return;
    }

    if (reservation.status === 'terminee' || reservation.status === 'embarquee') {
      toast.error('Ce passager est déjà enregistré');
      return;
    }

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('reservations')
        .update({
          status: 'terminee',
          payment_status: 'payee',
          updated_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      if (error) throw error;

      toast.success('Embarquement validé !');
      setReservation({ ...reservation, status: 'terminee' });

      setTimeout(() => {
        setSearchTerm('');
        setReservation(null);
      }, 4000);
    } catch (error: any) {
      toast.error('Erreur lors de la validation');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const statusInfo = reservation ? (STATUS_LABELS[reservation.status] || { label: reservation.status, color: 'var(--text-muted)' }) : null;
  const canBoard = reservation && !['annulee', 'terminee', 'embarquee'].includes(reservation.status);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Validation embarquement</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Saisir ou scanner la référence de réservation du passager
        </p>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Référence (ex: SBTA-2025-XXXXXXXX)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 rounded-lg border text-lg font-mono"
              style={{ borderColor: 'var(--border)' }}
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="px-6 py-3 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
      </div>

      {!reservation && !searching && (
        <div className="text-center py-16 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
          <Ticket className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>En attente de référence</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Saisissez la référence de réservation imprimée sur le billet
          </p>
        </div>
      )}

      {reservation && statusInfo && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>Référence</p>
              <p className="text-xl font-black font-mono" style={{ color: 'var(--primary)' }}>{reservation.booking_reference}</p>
            </div>
            <span className="px-3 py-1.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: `${statusInfo.color}18`, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Passager</p>
                  <p className="font-bold">{reservation.passenger_name}</p>
                  <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <Phone className="w-3.5 h-3.5" />{reservation.passenger_phone}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Itinéraire</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {(reservation.schedules as any)?.departure_station?.city?.name || '—'}
                    </span>
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="font-bold">
                      {(reservation.schedules as any)?.arrival_station?.city?.name || '—'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {reservation.schedules?.route_name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Départ</p>
                  <p className="font-bold">
                    {reservation.schedules?.departure_datetime
                      ? format(new Date(reservation.schedules.departure_datetime), 'dd MMMM yyyy à HH:mm', { locale: fr })
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Bus className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Bus · Sièges</p>
                  <p className="font-bold">
                    {reservation.schedules?.buses?.registration_number || '—'}
                    {' · '}
                    <span style={{ color: 'var(--primary)' }}>
                      {reservation.seat_numbers?.join(', ') || `${reservation.total_seats} place(s)`}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-raised)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Montant total</span>
                  <span className="font-black" style={{ color: 'var(--primary)' }}>
                    {formatCurrency(reservation.total_price)}
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span style={{ color: 'var(--text-muted)' }}>Statut paiement</span>
                  <span style={{ color: reservation.payment_status === 'payee' ? 'var(--success)' : 'var(--warning)' }}>
                    {reservation.payment_status === 'payee' ? 'Payé' : 'En attente'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-start gap-4">
              <div className="p-4 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG value={reservation.booking_reference} size={160} level="H" includeMargin />
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>QR Code de validation</p>
            </div>
          </div>

          <div className="px-6 pb-6">
            {reservation.status === 'annulee' && (
              <div className="p-4 rounded-lg flex items-start gap-3 mb-4"
                style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--danger)' }}>Réservation annulée</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--danger)' }}>
                    Cette réservation ne peut pas être utilisée pour l'embarquement.
                  </p>
                </div>
              </div>
            )}

            {(reservation.status === 'terminee' || reservation.status === 'embarquee') && (
              <div className="p-4 rounded-lg flex items-start gap-3 mb-4"
                style={{ backgroundColor: 'var(--success-light)', border: '1px solid var(--success)' }}>
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--success)' }}>Embarquement déjà validé</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--success)' }}>
                    Ce passager a déjà été enregistré pour ce voyage.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setSearchTerm(''); setReservation(null); }}
                className="flex-1 py-3 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Nouvelle recherche
              </button>
              {canBoard && (
                <button
                  onClick={handleValidateBoarding}
                  disabled={processing}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  {processing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Validation...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" />Valider l'embarquement</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
