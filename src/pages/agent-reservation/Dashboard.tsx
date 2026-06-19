import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TicketCheck, CheckCircle, XCircle, Clock, BadgeCheck, Wallet,
  Receipt, CreditCard, Users, UserPlus, RefreshCw, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/formatCurrency';
import { fetchBookings, fetchMobileUsers, type MobileBooking, type MobileUser } from '@/services/agentReservation.service';
import { Badge, STATUS_LABELS, STATUS_COLORS, useRealtimeSync } from './shared';

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function AgentReservationDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([fetchBookings(), fetchMobileUsers()])
      .then(([b, u]) => { setBookings(b); setUsers(u); })
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des données'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['mobile_bookings', 'users'], load);

  const stats = useMemo(() => {
    const today = bookings.filter((b) => isToday(b.created_at));
    const paid = today.filter((b) => b.payment_status === 'paid');
    return {
      total: today.length,
      confirmed: today.filter((b) => b.status === 'confirmed').length,
      cancelled: today.filter((b) => b.status === 'cancelled').length,
      provisional: today.filter((b) => b.status === 'provisional').length,
      sales: paid.reduce((s, b) => s + b.total, 0),
      serviceFees: paid.reduce((s, b) => s + b.service_fee, 0),
      paymentsReceived: paid.length,
      newUsers: users.filter((u) => isToday(u.created_at)).length,
      activeUsers: users.filter((u) => u.status === 'active').length,
    };
  }, [bookings, users]);

  const recent = bookings.slice(0, 6);

  const reservationCards = [
    { label: 'Billets réservés', value: stats.total, icon: TicketCheck, color: '#0B7439', bg: '#E7F6EC' },
    { label: 'Billets définitifs', value: stats.confirmed, icon: BadgeCheck, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'Billets provisoires', value: stats.provisional, icon: Clock, color: '#B45309', bg: '#FEF3C7' },
    { label: 'Billets annulés', value: stats.cancelled, icon: XCircle, color: '#B91C1C', bg: '#FEE2E2' },
  ];
  const financeCards = [
    { label: 'Ventes totales', value: formatCurrency(stats.sales), icon: Wallet, color: '#0B7439', bg: '#E7F6EC' },
    { label: 'Frais de service', value: formatCurrency(stats.serviceFees), icon: Receipt, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'Paiements reçus', value: stats.paymentsReceived, icon: CreditCard, color: '#0B7439', bg: '#E7F6EC' },
    { label: 'Confirmés', value: stats.confirmed, icon: CheckCircle, color: '#16A34A', bg: '#E7F6EC' },
  ];
  const userCards = [
    { label: 'Nouveaux inscrits', value: stats.newUsers, icon: UserPlus, color: '#B45309', bg: '#FEF3C7' },
    { label: 'Utilisateurs actifs', value: stats.activeUsers, icon: Users, color: '#0B7439', bg: '#E7F6EC' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const Section = ({ title, cards }: { title: string; cards: typeof reservationCards }) => (
    <div>
      <h2 className="text-sm font-semibold text-[#4A6B55] uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.bg }}>
                <Icon className="w-6 h-6" style={{ color: c.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] font-medium">{c.label}</p>
                <p className="text-xl font-bold text-[#1A2E22] truncate">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-7 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Tableau de bord Agent Réservation</h1>
          <p className="text-sm text-[#6B7280] mt-1">Activité du jour synchronisée avec l'application mobile</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <Section title="Réservations" cards={reservationCards} />
      <Section title="Finances" cards={financeCards} />
      <Section title="Utilisateurs" cards={userCards} />

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2EAE5]">
          <h2 className="font-semibold text-[#1A2E22]">Dernières réservations</h2>
          <button onClick={() => navigate('/agent-reservation/tickets')} className="text-sm font-medium text-[#0B7439] inline-flex items-center gap-1 hover:underline">
            Voir tout <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-[#F0F4F1]">
          {recent.length === 0 ? (
            <div className="py-12 text-center text-[#6B7280] text-sm">Aucune réservation pour le moment.</div>
          ) : recent.map((b) => (
            <button
              key={b.id}
              onClick={() => navigate('/agent-reservation/tickets')}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAF8] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A2E22] truncate">
                  {b.booking_ref} · {b.origin_city} → {b.destination_city}
                </p>
                <p className="text-xs text-[#8AA898]">
                  {b.customer_name ?? '—'} · {b.seats_count} place(s) · {formatCurrency(b.total)}
                </p>
              </div>
              <Badge map={STATUS_LABELS} colors={STATUS_COLORS} value={b.status} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
