import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, XCircle, ArrowRight, Ticket, Plus, Loader2 } from 'lucide-react';
import { SBTA, formatXOF } from '../theme';
import { Button, Card, BottomNav, Logo } from '../components';
import { Booking, fetchMyBookings } from '../api';
import { useMobileAuth } from '../MobileAuthContext';

const STATUS: Record<Booking['status'], { label: string; color: string; bg: string; icon: typeof Clock }> = {
  provisional: { label: 'Provisoire', color: '#7A5C00', bg: '#FFF8E6', icon: Clock },
  confirmed: { label: 'Confirmé', color: SBTA.greenDark, bg: SBTA.greenLight, icon: CheckCircle2 },
  cancelled: { label: 'Annulé', color: SBTA.redDark, bg: '#FDECEC', icon: XCircle },
};

export default function MyTicketsScreen() {
  const navigate = useNavigate();
  const { user } = useMobileAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchMyBookings(user.id)
      .then(setBookings)
      .catch(() => setError('Impossible de charger vos billets.'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pb-4 pt-12" style={{ background: `linear-gradient(160deg, ${SBTA.green}, ${SBTA.greenDark})` }}>
        <div className="mb-4 flex justify-center">
          <div className="rounded-2xl bg-white px-4 py-2 shadow-sm">
            <Logo width={150} />
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Mes billets</h1>
        <p className="text-sm text-white opacity-90">Vos réservations SBTA</p>
      </div>

      <div className="flex-1 space-y-3 px-6 pb-6 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={26} className="animate-spin" color={SBTA.green} />
          </div>
        ) : error ? (
          <div className="text-sm font-medium" style={{ color: SBTA.redDark }}>{error}</div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center pt-16 text-center">
            <Ticket size={48} color={SBTA.gray400} />
            <p className="mt-4 font-bold" style={{ color: SBTA.ink }}>Aucun billet pour le moment</p>
            <p className="mt-1 text-sm" style={{ color: SBTA.gray600 }}>
              Réservez votre premier voyage avec SBTA.
            </p>
            <div className="mt-5">
              <Button onClick={() => navigate('/sbtamobile/search')}>
                <span className="flex items-center gap-2"><Plus size={17} /> Nouvelle réservation</span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {bookings.map((b) => {
              const s = STATUS[b.status];
              return (
                <button key={b.id} onClick={() => navigate(`/sbtamobile/ticket/${b.id}`)} className="w-full text-left">
                  <Card>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: SBTA.gray400 }}>{b.booking_ref}</span>
                      <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={{ background: s.bg, color: s.color }}>
                        <s.icon size={12} /> {s.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[15px] font-extrabold" style={{ color: SBTA.ink }}>{b.origin_city}</span>
                      <ArrowRight size={15} color={SBTA.gray400} />
                      <span className="text-[15px] font-extrabold" style={{ color: SBTA.ink }}>{b.destination_city}</span>
                    </div>
                    {(b.origin_station || b.destination_station) && (
                      <div className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold" style={{ color: SBTA.gray600 }}>
                        <span className="truncate">{b.origin_station ?? '—'}</span>
                        <ArrowRight size={12} color={SBTA.gray400} className="shrink-0" />
                        <span className="truncate">{b.destination_station ?? '—'}</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between text-sm" style={{ color: SBTA.gray600 }}>
                      <span>
                        {new Date(b.travel_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {b.departure_time ? ` · ${b.departure_time}` : ''} · {b.seats_count} pl.
                      </span>
                      <span className="font-bold" style={{ color: SBTA.green }}>{formatXOF(b.total)}</span>
                    </div>
                  </Card>
                </button>
              );
            })}
            <Button full variant="outline" onClick={() => navigate('/sbtamobile/search')}>
              <span className="flex items-center justify-center gap-2"><Plus size={17} /> Nouvelle réservation</span>
            </Button>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
