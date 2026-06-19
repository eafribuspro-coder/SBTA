import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserX, Users as UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchMobileUsers, setUserStatus, type MobileUser } from '@/services/agentReservation.service';
import { Badge, USER_STATUS_LABELS, USER_STATUS_COLORS, useRealtimeSync } from './shared';

export default function MobileUsers() {
  const [users, setUsers] = useState<MobileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetchMobileUsers()
      .then(setUsers)
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des utilisateurs'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['users'], load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && (u.status ?? '') !== statusFilter) return false;
      if (!q) return true;
      return [u.full_name, u.email, u.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [users, search, statusFilter]);

  const toggleStatus = async (u: MobileUser) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    if (!window.confirm(next === 'suspended' ? `Suspendre ${u.full_name} ?` : `Réactiver ${u.full_name} ?`)) return;
    setBusyId(u.id);
    try {
      await setUserStatus(u.id, next);
      toast.success(next === 'suspended' ? 'Compte suspendu' : 'Compte réactivé');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  const tabs = [
    { key: 'all', label: 'Tous' },
    { key: 'active', label: 'Actifs' },
    { key: 'pending_otp', label: 'En attente OTP' },
    { key: 'suspended', label: 'Suspendus' },
  ];

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E22]">Utilisateurs Mobile</h1>
        <p className="text-sm text-[#6B7280] mt-1">Comptes clients créés depuis l'application mobile</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8AA898]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, email, téléphone)"
            className="w-full border border-[#E2EAE5] rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
          />
        </div>
        <div className="flex gap-1.5 bg-[#F1F5F2] rounded-xl p-1 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={statusFilter === t.key ? { backgroundColor: '#fff', color: '#0B7439', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } : { color: '#6B7280' }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-9 h-9 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <UsersIcon className="w-10 h-10 mb-2 text-[#C5D6CC]" />
            <p className="text-sm">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#8AA898] border-b border-[#E2EAE5]">
                  <th className="px-4 py-3 font-semibold">Nom</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Inscription</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F8FAF8]">
                    <td className="px-4 py-3 font-medium text-[#1A2E22]">{u.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{u.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55] whitespace-nowrap">{u.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55] whitespace-nowrap">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-4 py-3"><Badge map={USER_STATUS_LABELS} colors={USER_STATUS_COLORS} value={u.status ?? 'inactive'} /></td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(u)}
                        disabled={busyId === u.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        style={u.status === 'suspended'
                          ? { backgroundColor: '#E7F6EC', color: '#0B7439' }
                          : { backgroundColor: '#FEE2E2', color: '#B91C1C' }}
                      >
                        {u.status === 'suspended'
                          ? <><UserCheck className="w-3.5 h-3.5" /> Réactiver</>
                          : <><UserX className="w-3.5 h-3.5" /> Suspendre</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
