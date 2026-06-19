import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, Lock } from 'lucide-react';
import { SBTA, SLOGAN } from '../theme';
import { Button, Field, TopBar, Logo } from '../components';
import { useMobileAuth } from '../MobileAuthContext';

export default function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useMobileAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!identifier.trim() || !password) return setError('Veuillez renseigner vos identifiants.');
    setLoading(true);
    try {
      await login(identifier, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/sbtamobile') ? from : '/sbtamobile/search', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar onBack />
      <div className="flex-1 px-6">
        <div className="mb-8 mt-2">
          <div className="flex justify-center">
            <Logo width={200} />
          </div>
          <h2 className="mt-6 text-center text-2xl font-extrabold" style={{ color: SBTA.ink }}>
            Bon retour !
          </h2>
          <p className="mt-1 text-center text-[15px]" style={{ color: SBTA.gray600 }}>
            {SLOGAN}
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Téléphone ou Email" placeholder="07 00 00 00 00" value={identifier}
            onChange={(e) => setIdentifier(e.target.value)} icon={<Phone size={18} color={SBTA.gray400} />} />
          <Field label="Mot de passe" placeholder="Votre mot de passe" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} icon={<Lock size={18} color={SBTA.gray400} />} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm" style={{ color: SBTA.gray600 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-[#008F39]" />
            Se souvenir de moi
          </label>
          <button onClick={() => navigate('/sbtamobile/forgot-password')}
            className="text-sm font-semibold" style={{ color: SBTA.green }}>
            Mot de passe oublié ?
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: '#FDECEC', color: SBTA.redDark }}>
            {error}
          </div>
        )}
      </div>
      <div className="space-y-3 p-6">
        <Button full onClick={submit} disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </Button>
        <button onClick={() => navigate('/sbtamobile/register')}
          className="w-full text-center text-sm font-semibold" style={{ color: SBTA.gray600 }}>
          Pas encore de compte ? <span style={{ color: SBTA.green }}>S'inscrire</span>
        </button>
      </div>
    </div>
  );
}
