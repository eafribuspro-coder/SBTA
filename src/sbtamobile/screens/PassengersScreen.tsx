import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, CreditCard, ArrowRight } from 'lucide-react';
import { SBTA } from '../theme';
import { Button, TopBar, Card } from '../components';
import { Passenger } from '../api';
import { useBooking } from '../BookingContext';
import { useMobileAuth } from '../MobileAuthContext';

function emptyPassenger(): Passenger {
  return { firstName: '', lastName: '', phone: '', idNumber: '' };
}

export default function PassengersScreen() {
  const navigate = useNavigate();
  const { draft, setPassengers } = useBooking();
  const { user } = useMobileAuth();
  const count = draft.seatsCount;
  const search = draft.search;
  const [list, setList] = useState<Passenger[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!draft.trip) {
      navigate('/sbtamobile/search', { replace: true });
      return;
    }
    const base = Array.from({ length: count }, (_, i) => draft.passengers[i] ?? emptyPassenger());
    if (user && !base[0].firstName && !base[0].lastName) {
      const parts = user.fullName.trim().split(/\s+/);
      base[0] = {
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' ') || '',
        phone: user.phone ?? '',
        idNumber: '',
      };
    }
    setList(base);
  }, [count]);

  function update(idx: number, key: keyof Passenger, value: string) {
    setList((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));
  }

  function submit() {
    setError('');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.firstName.trim() || !p.lastName.trim()) {
        return setError(`Renseignez le nom et le prénom du passager ${i + 1}.`);
      }
      if (!p.phone.trim()) {
        return setError(`Renseignez le téléphone du passager ${i + 1}.`);
      }
    }
    setPassengers(list);
    navigate('/sbtamobile/payment-method');
  }

  const inputCls = 'w-full bg-transparent py-3 text-[15px] outline-none';

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Informations passagers" onBack />
      <div className="flex-1 space-y-4 px-6 pb-6 pt-2">
        {search && (
          <Card>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold" style={{ color: SBTA.ink }}>{search.originName}</div>
                {search.originStationName && <div className="text-[12px] font-semibold" style={{ color: SBTA.green }}>{search.originStationName}</div>}
              </div>
              <ArrowRight size={16} color={SBTA.gray400} className="shrink-0" />
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[15px] font-extrabold" style={{ color: SBTA.ink }}>{search.destName}</div>
                {search.destStationName && <div className="text-[12px] font-semibold" style={{ color: SBTA.red }}>{search.destStationName}</div>}
              </div>
            </div>
          </Card>
        )}
        {list.map((p, idx) => (
          <Card key={idx}>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{ background: SBTA.greenLight, color: SBTA.green }}>{idx + 1}</div>
              <span className="font-bold" style={{ color: SBTA.ink }}>Passager {idx + 1}</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: SBTA.gray100 }}>
                <User size={16} color={SBTA.gray400} />
                <input className={inputCls} style={{ color: SBTA.ink }} placeholder="Nom"
                  value={p.lastName} onChange={(e) => update(idx, 'lastName', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: SBTA.gray100 }}>
                <User size={16} color={SBTA.gray400} />
                <input className={inputCls} style={{ color: SBTA.ink }} placeholder="Prénom"
                  value={p.firstName} onChange={(e) => update(idx, 'firstName', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: SBTA.gray100 }}>
                <Phone size={16} color={SBTA.gray400} />
                <input className={inputCls} style={{ color: SBTA.ink }} placeholder="Téléphone" type="tel"
                  value={p.phone} onChange={(e) => update(idx, 'phone', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: SBTA.gray100 }}>
                <CreditCard size={16} color={SBTA.gray400} />
                <input className={inputCls} style={{ color: SBTA.ink }} placeholder="Pièce d'identité (optionnel)"
                  value={p.idNumber} onChange={(e) => update(idx, 'idNumber', e.target.value)} />
              </div>
            </div>
          </Card>
        ))}
        {error && <div className="text-sm font-medium" style={{ color: SBTA.redDark }}>{error}</div>}
      </div>

      <div className="p-6">
        <Button full onClick={submit}>Continuer</Button>
      </div>
    </div>
  );
}
