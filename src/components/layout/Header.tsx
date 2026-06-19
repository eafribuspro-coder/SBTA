import { useState, useEffect, useRef } from 'react';
import { Bell, LogOut, User, Clock, Monitor, Menu, ChevronDown, UserCog } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { countPendingAccounts } from '../../services/employeeAccount.service';
import { supabase } from '../../services/supabase';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  daf: 'Directeur Financier',
  comptable: 'Comptable',
  gestionnaire: 'Gestionnaire',
  chauffeur: 'Chauffeur',
  guichetier: 'Guichetier',
  agent_reservation: 'Agent Réservation',
  chef_garage: 'Chef Garage',
  mecanicien: 'Mécanicien',
  planificateur: 'Planificateur',
  pompiste: 'Pompiste',
  chef_gare: 'Chef de Gare',
  rh: 'Ressources Humaines',
  client: 'Client',
  agent_colis: 'Agent Courrier',
  superviseur_colis: 'Superviseur Courrier',
  gerant_principal: 'Gérant Principal',
};

interface HeaderProps {
  onMenuToggle: () => void;
  sidebarCollapsed: boolean;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [counterNumber, setCounterNumber] = useState<string | null>(null);
  const [counterStation, setCounterStation] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (user?.role !== 'guichetier') return;
    supabase
      .from('counters')
      .select('counter_number, stations(name)')
      .eq('assigned_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setCounterNumber(data.counter_number ?? null);
        const st = data.stations as { name: string } | null;
        setCounterStation(st?.name ?? null);
      });
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    countPendingAccounts().then(setPendingCount).catch(() => {});
    const interval = setInterval(() => {
      countPendingAccounts().then(setPendingCount).catch(() => {});
    }, 30_000);
    const channel = supabase
      .channel('header-pending-employees')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'employees', filter: 'account_status=eq.pending' }, () => {
        countPendingAccounts().then(setPendingCount).catch(() => {});
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, () => {
        countPendingAccounts().then(setPendingCount).catch(() => {});
      })
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [user?.role]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Déconnexion réussie');
    } catch {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  if (!user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;
  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header
      className="h-14 sm:h-16 border-b flex items-center px-3 sm:px-4 lg:px-6 gap-3 flex-shrink-0"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title zone */}
      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {user.full_name}
        </p>
        <p className="text-xs truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>
          {roleLabel}
        </p>
      </div>

      {/* Right zone */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Guichet badge */}
        {user?.role === 'guichetier' && counterNumber && (
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold"
            style={{ backgroundColor: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            title={counterStation ? `Gare : ${counterStation}` : undefined}
          >
            <Monitor className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Guichet {counterNumber}</span>
          </div>
        )}

        {/* Pending badge admin */}
        {user?.role === 'admin' && pendingCount > 0 && (
          <Link
            to="/admin/users?tab=pending"
            className="hidden sm:flex relative items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{ backgroundColor: '#FEF3C7', border: '1px solid #D97706', color: '#92400E' }}
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{pendingCount} en attente</span>
            <span
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: '#AF3029', fontSize: 10 }}
            >
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </Link>
        )}

        {/* Bell */}
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--text-secondary)' }} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--secondary)' }} />
        </button>

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
            >
              {user.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                : initials}
            </div>
            <ChevronDown className="w-3.5 h-3.5 hidden sm:block" style={{ color: 'var(--text-muted)' }} />
          </button>

          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-2xl shadow-xl overflow-hidden z-50"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-subtle)' }}>
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{user.full_name}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                <span
                  className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}
                >
                  {roleLabel}
                </span>
              </div>

              {/* Guichet mobile */}
              {user?.role === 'guichetier' && counterNumber && (
                <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
                  <Monitor className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Guichet {counterNumber}
                    {counterStation && <span style={{ color: 'var(--text-muted)' }}> — {counterStation}</span>}
                  </span>
                </div>
              )}

              {/* Pending mobile */}
              {user?.role === 'admin' && pendingCount > 0 && (
                <Link
                  to="/admin/users?tab=pending"
                  className="flex items-center gap-2 px-4 py-2.5 border-b transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border)' }}
                  onClick={() => setProfileOpen(false)}
                >
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#D97706' }} />
                  <span className="text-sm" style={{ color: '#92400E' }}>{pendingCount} compte{pendingCount > 1 ? 's' : ''} en attente</span>
                </Link>
              )}

              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-gray-50"
                onClick={() => setProfileOpen(false)}
                style={{ color: 'var(--text-secondary)' }}
              >
                <UserCog className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">Mon profil</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 transition-colors hover:bg-red-50 border-t"
                style={{ borderColor: 'var(--border)', color: '#AF3029' }}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium">Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
