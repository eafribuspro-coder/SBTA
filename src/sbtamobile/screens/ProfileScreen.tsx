import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, LogOut, ShieldCheck, Ticket, ChevronRight, HelpCircle } from 'lucide-react';
import { SBTA } from '../theme';
import { Button, Card, BottomNav } from '../components';
import { useMobileAuth } from '../MobileAuthContext';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, logout } = useMobileAuth();

  async function handleLogout() {
    await logout();
    navigate('/sbtamobile');
  }

  const initials = (user?.fullName ?? 'C')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pb-8 pt-12 text-center" style={{ background: `linear-gradient(160deg, ${SBTA.green}, ${SBTA.greenDark})` }}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full text-2xl font-extrabold"
          style={{ background: 'rgba(255,255,255,0.22)', color: SBTA.white }}>
          {initials}
        </div>
        <div className="mt-3 text-xl font-extrabold text-white">{user?.fullName ?? 'Client SBTA'}</div>
        <div className="text-sm text-white opacity-90">{user?.email ?? ''}</div>
      </div>

      <div className="flex-1 space-y-4 px-6 pb-6 pt-5">
        <Card>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide" style={{ color: SBTA.gray400 }}>
            Mes informations
          </h3>
          <div className="space-y-3">
            <InfoRow icon={User} label="Nom complet" value={user?.fullName ?? '-'} />
            <InfoRow icon={Mail} label="Email" value={user?.email ?? '-'} />
            <InfoRow icon={Phone} label="Téléphone" value={user?.phone || '-'} />
          </div>
        </Card>

        <button onClick={() => navigate('/sbtamobile/tickets')} className="w-full text-left">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: SBTA.greenLight }}>
                <Ticket size={17} color={SBTA.green} />
              </div>
              <span className="flex-1 font-semibold" style={{ color: SBTA.ink }}>Mes billets</span>
              <ChevronRight size={18} color={SBTA.gray400} />
            </div>
          </Card>
        </button>

        <button onClick={() => navigate('/sbtamobile/help')} className="w-full text-left">
          <Card>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: SBTA.greenLight }}>
                <HelpCircle size={17} color={SBTA.green} />
              </div>
              <span className="flex-1 font-semibold" style={{ color: SBTA.ink }}>Aide & FAQ</span>
              <ChevronRight size={18} color={SBTA.gray400} />
            </div>
          </Card>
        </button>

        <Card style={{ background: SBTA.greenLight, border: 'none' }}>
          <div className="flex gap-2">
            <ShieldCheck size={18} color={SBTA.green} className="shrink-0" />
            <p className="text-[13px] leading-relaxed" style={{ color: SBTA.greenDark }}>
              Vos données sont protégées et utilisées uniquement pour gérer vos réservations SBTA.
            </p>
          </div>
        </Card>
      </div>

      <div className="px-6 pb-4">
        <Button full variant="secondary" onClick={handleLogout}>
          <span className="flex items-center justify-center gap-2"><LogOut size={17} /> Déconnexion</span>
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: SBTA.gray100 }}>
        <Icon size={17} color={SBTA.gray600} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs" style={{ color: SBTA.gray400 }}>{label}</div>
        <div className="truncate text-[15px] font-semibold" style={{ color: SBTA.ink }}>{value}</div>
      </div>
    </div>
  );
}
