import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Delete } from 'lucide-react';
import { SBTA } from '../theme';
import { TopBar, Logo } from '../components';
import { useMobileAuth } from '../MobileAuthContext';

const RESEND_SECONDS = 45;

type OtpState = { phone?: string; email?: string; password?: string };

export default function OtpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyOtp, resendOtp, login } = useMobileAuth();
  const state = (location.state as OtpState | null) ?? {};
  const { phone, email, password } = state;

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const verify = useCallback(
    async (code: string) => {
      if (!phone || !email || !password) return;
      setBusy(true);
      setError('');
      try {
        await verifyOtp(phone, code);
        await login(email, password);
        navigate('/sbtamobile/search', { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Code OTP incorrect. Veuillez réessayer.');
        setDigits(['', '', '', '', '', '']);
      } finally {
        setBusy(false);
      }
    },
    [phone, email, password, verifyOtp, login, navigate],
  );

  function press(n: string) {
    if (busy) return;
    setError('');
    setDigits((d) => {
      const idx = d.findIndex((x) => x === '');
      if (idx === -1) return d;
      const next = [...d];
      next[idx] = n;
      if (idx === 5) {
        const code = next.join('');
        setTimeout(() => verify(code), 80);
      }
      return next;
    });
  }

  function backspace() {
    if (busy) return;
    setError('');
    setDigits((d) => {
      const filled = d.filter((x) => x !== '').length;
      if (filled === 0) return d;
      const next = [...d];
      next[filled - 1] = '';
      return next;
    });
  }

  async function resend() {
    if (!phone) return;
    setError('');
    setDigits(['', '', '', '', '', '']);
    try {
      await resendOtp(phone);
      setSeconds(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'envoyer le code.");
    }
  }

  if (!phone || !email || !password) {
    return <Navigate to="/sbtamobile/register" replace />;
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Vérification" onBack />

      <div className="flex flex-1 flex-col px-6 pt-8">
        <div className="flex justify-center pb-6">
          <Logo width={150} />
        </div>
        <p className="text-center text-[15px]" style={{ color: SBTA.gray600 }}>
          Un code de vérification a été envoyé à
        </p>
        <p className="mt-1 text-center text-lg font-extrabold" style={{ color: SBTA.ink }}>
          {phone}
        </p>

        <div className="mx-auto mt-8 flex max-w-[330px] justify-between gap-2.5">
          {digits.map((d, i) => {
            const isCursor = digits.findIndex((x) => x === '') === i;
            return (
              <div
                key={i}
                className="flex h-14 w-12 items-center justify-center rounded-xl text-2xl font-extrabold"
                style={{
                  background: SBTA.white,
                  border: `2px solid ${d ? SBTA.green : isCursor ? SBTA.green : SBTA.gray200}`,
                  color: SBTA.ink,
                }}
              >
                {d}
              </div>
            );
          })}
        </div>

        {error && (
          <div
            className="mx-auto mt-5 max-w-[330px] rounded-xl px-4 py-2.5 text-center text-sm font-medium"
            style={{ background: '#FDECEC', color: SBTA.redDark }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-sm" style={{ color: SBTA.gray600 }}>
          {seconds > 0 ? (
            <>Renvoyer le code dans <b style={{ color: SBTA.ink }}>{mmss}</b></>
          ) : (
            <button onClick={resend} className="font-bold" style={{ color: SBTA.green }}>
              Renvoyer le code
            </button>
          )}
        </div>

        <div className="mt-auto pb-6 pt-8">
          <div className="mx-auto grid max-w-[330px] grid-cols-3 gap-3">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                disabled={busy}
                className="rounded-2xl py-4 text-2xl font-semibold transition active:scale-95 disabled:opacity-50"
                style={{ background: SBTA.white, border: `1px solid ${SBTA.gray200}`, color: SBTA.ink }}
              >
                {k}
              </button>
            ))}
            <div />
            <button
              onClick={() => press('0')}
              disabled={busy}
              className="rounded-2xl py-4 text-2xl font-semibold transition active:scale-95 disabled:opacity-50"
              style={{ background: SBTA.white, border: `1px solid ${SBTA.gray200}`, color: SBTA.ink }}
            >
              0
            </button>
            <button
              onClick={backspace}
              disabled={busy}
              className="flex items-center justify-center rounded-2xl py-4 transition active:scale-95 disabled:opacity-50"
              style={{ background: SBTA.gray100, color: SBTA.ink }}
              aria-label="Effacer"
            >
              <Delete size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
