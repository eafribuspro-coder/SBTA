import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Wallet, XCircle, UserPlus, Bus, MapPin, BadgeCheck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/formatCurrency';
import { fetchBookings, fetchMobileUsers, type MobileBooking, type MobileUser } from '@/services/agentReservation.service';
import { useRealtimeSync } from './shared';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function Analytics() {
  const [bookings, setBookings] = useState<MobileBooking[]>([]);
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([fetchBookings(), fetchMobileUsers()])
      .then(([b, u]) => { setBookings(b); setUsers(u); })
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des analyses'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['mobile_bookings', 'users'], load);

  const year = new Date().getFullYear();

  const monthly = useMemo(() => {
    const base = MONTHS.map((m) => ({ month: m, reservations: 0, gains: 0, paiements: 0 }));
    bookings.forEach((b) => {
      if (!b.created_at) return;
      const d = new Date(b.created_at);
      if (d.getFullYear() !== year) return;
      const slot = base[d.getMonth()];
      if (b.status !== 'cancelled') slot.reservations += 1;
      if (b.payment_status === 'paid') {
        slot.gains += b.service_fee;
        slot.paiements += b.total;
      }
    });
    return base;
  }, [bookings, year]);

  const topBus = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => {
      if (b.status === 'cancelled') return;
      const k = b.bus_label ?? 'Non attribué';
      map.set(k, (map.get(k) ?? 0) + b.seats_count);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [bookings]);

  const topCities = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => {
      if (b.status === 'cancelled' || !b.origin_city) return;
      const k = `${b.origin_city} → ${b.destination_city ?? ''}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [bookings]);

  const kpis = useMemo(() => {
    const active = bookings.filter((b) => b.status !== 'cancelled');
    const cancelled = bookings.filter((b) => b.status === 'cancelled');
    const paid = bookings.filter((b) => b.payment_status === 'paid');
    const total = bookings.length;
    return {
      totalReservations: active.length,
      totalGains: paid.reduce((s, b) => s + b.service_fee, 0),
      totalPaiements: paid.reduce((s, b) => s + b.total, 0),
      cancelRate: total > 0 ? Math.round((cancelled.length / total) * 100) : 0,
      newClients: users.length,
      provisional: bookings.filter((b) => b.status === 'provisional').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    };
  }, [bookings, users]);

  const statusPie = useMemo(() => ([
    { name: 'Provisoires', value: kpis.provisional, color: '#B45309' },
    { name: 'Définitifs', value: kpis.confirmed, color: '#0B7439' },
    { name: 'Annulés', value: bookings.filter((b) => b.status === 'cancelled').length, color: '#B91C1C' },
  ]), [kpis, bookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Réservations totales', value: String(kpis.totalReservations), icon: TrendingUp, color: '#0B7439', bg: '#E7F6EC' },
    { label: 'Gains totaux (frais)', value: formatCurrency(kpis.totalGains), icon: Wallet, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'Paiements totaux', value: formatCurrency(kpis.totalPaiements), icon: BadgeCheck, color: '#16A34A', bg: '#E7F6EC' },
    { label: "Taux d'annulation", value: `${kpis.cancelRate}%`, icon: XCircle, color: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Nouveaux clients', value: String(kpis.newClients), icon: UserPlus, color: '#B45309', bg: '#FEF3C7' },
    { label: 'Billets provisoires', value: String(kpis.provisional), icon: Clock, color: '#B45309', bg: '#FEF3C7' },
  ];

  const Card = ({ title, icon: Icon, children }: { title: string; icon: typeof Bus; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-[#0B7439]" />
        <h2 className="font-semibold text-[#1A2E22] text-sm">{title}</h2>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E22]">Rapports d'analyse</h1>
        <p className="text-sm text-[#6B7280] mt-1">Indicateurs et tendances des réservations mobiles ({year})</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ backgroundColor: c.bg }}>
                <Icon className="w-5 h-5" style={{ color: c.color }} />
              </div>
              <p className="text-xs text-[#6B7280] font-medium">{c.label}</p>
              <p className="text-lg font-bold text-[#1A2E22] mt-0.5 truncate">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Réservations par mois" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F1" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8AA898' }} />
              <YAxis tick={{ fontSize: 12, fill: '#8AA898' }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="reservations" name="Réservations" fill="#0B7439" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Gains et paiements par mois" icon={Wallet}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F1" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8AA898' }} />
              <YAxis tick={{ fontSize: 12, fill: '#8AA898' }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="paiements" name="Paiements" stroke="#1D4ED8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gains" name="Gains" stroke="#0B7439" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Répartition des billets" icon={BadgeCheck}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusPie.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top lignes" icon={MapPin}>
          {topCities.length === 0 ? (
            <p className="text-sm text-[#8AA898] py-12 text-center">Aucune donnée.</p>
          ) : (
            <div className="space-y-3">
              {topCities.map((c, i) => {
                const max = topCities[0].value || 1;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#1A2E22] font-medium truncate">{i + 1}. {c.name}</span>
                      <span className="text-[#6B7280]">{c.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F1F5F2] overflow-hidden">
                      <div className="h-full rounded-full bg-[#0B7439]" style={{ width: `${(c.value / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title="Top bus (places réservées)" icon={Bus}>
        {topBus.length === 0 ? (
          <p className="text-sm text-[#8AA898] py-8 text-center">Aucune donnée.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topBus} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F1" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#8AA898' }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#8AA898' }} />
              <Tooltip />
              <Bar dataKey="value" name="Places" fill="#1D4ED8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
