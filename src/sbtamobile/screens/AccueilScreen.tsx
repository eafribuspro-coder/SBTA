import { useNavigate } from 'react-router-dom';
import { ShieldCheck, BadgeCheck, Bus } from 'lucide-react';
import { SBTA } from '../theme';
import { LOGO_SRC, LOGO_ALT } from '../components';

const TRUST = [
  { icon: ShieldCheck, label: 'Sécurisé' },
  { icon: BadgeCheck, label: 'Fiable' },
  { icon: Bus, label: 'Confortable' },
];

export default function AccueilScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col px-7 pb-10 pt-14" style={{ background: SBTA.white }}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <img
          src={LOGO_SRC}
          alt={LOGO_ALT}
          draggable={false}
          className="h-auto w-[72%] min-w-[220px] max-w-[280px] select-none object-contain"
        />
        <p className="mt-8 text-center text-xl font-bold leading-snug" style={{ color: SBTA.ink }}>
          Votre partenaire de voyage
          <br />
          en toute sécurité
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => navigate('/sbtamobile/login')}
          className="w-full rounded-full py-4 text-[15px] font-bold tracking-wide transition active:scale-[0.97]"
          style={{ background: SBTA.green, color: SBTA.white, boxShadow: '0 10px 24px rgba(0,143,57,0.28)' }}
        >
          SE CONNECTER
        </button>
        <button
          onClick={() => navigate('/sbtamobile/register')}
          className="w-full rounded-full py-4 text-[15px] font-bold tracking-wide transition active:scale-[0.97]"
          style={{ background: SBTA.white, color: SBTA.red, border: `2px solid ${SBTA.red}` }}
        >
          CRÉER UN COMPTE
        </button>
      </div>

      <div className="mt-10 grid grid-cols-3">
        {TRUST.map((t) => (
          <div key={t.label} className="flex flex-col items-center gap-2">
            <t.icon size={24} color={SBTA.green} />
            <span className="text-xs font-medium" style={{ color: SBTA.gray600 }}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
