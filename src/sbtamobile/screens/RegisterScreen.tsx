import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, Lock } from 'lucide-react';
import { SBTA } from '../theme';
import { Button, Field, TopBar, Logo } from '../components';
import { useMobileAuth } from '../MobileAuthContext';

export default function RegisterScreen() {
  const navigate = useNavigate();
  const { register } = useMobileAuth();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '', confirm: '' });
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    setError('');
    const phone = form.phone.replace(/\s+/g, '');
    if (!form.fullName.trim()) return setError('Le nom complet est obligatoire.');
    if (!form.phone.trim()) return setError('Le numéro de téléphone est obligatoire.');
    if (!/^0\d{9}$/.test(phone)) return setError('Le numéro de téléphone est invalide (10 chiffres, ex. 0700000000).');
    if (!form.email.trim()) return setError("L'email est obligatoire.");
    if (form.password.length < 8) return setError('Le mot de passe doit contenir au moins 8 caractères.');
    if (form.password !== form.confirm) return setError('Les mots de passe ne correspondent pas.');
    if (!accept) return setError("Veuillez accepter les conditions d'utilisation.");

    setLoading(true);
    try {
      await register({
        fullName: form.fullName,
        phone,
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/sbtamobile/otp', {
        state: { phone, email: form.email.trim(), password: form.password },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Créer un compte" onBack />
      <div className="flex-1 space-y-4 p-6">
        <div className="flex justify-center pb-1">
          <Logo width={180} />
        </div>
        <p className="text-[15px]" style={{ color: SBTA.gray600 }}>
          Créez votre compte pour réserver vos voyages en quelques secondes.
        </p>
        <Field label="Nom complet" placeholder="Koffi Kouamé" value={form.fullName}
          onChange={set('fullName')} icon={<User size={18} color={SBTA.gray400} />} />
        <Field label="Téléphone" placeholder="07 00 00 00 00" value={form.phone} type="tel"
          onChange={set('phone')} icon={<Phone size={18} color={SBTA.gray400} />} />
        <Field label="Email" placeholder="exemple@mail.com" value={form.email} type="email"
          onChange={set('email')} icon={<Mail size={18} color={SBTA.gray400} />} />
        <Field label="Mot de passe" placeholder="8 caractères minimum" value={form.password} type="password"
          onChange={set('password')} icon={<Lock size={18} color={SBTA.gray400} />} />
        <Field label="Confirmer le mot de passe" placeholder="Répétez le mot de passe" value={form.confirm} type="password"
          onChange={set('confirm')} icon={<Lock size={18} color={SBTA.gray400} />} />

        <label className="flex items-start gap-2.5">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#008F39]" />
          <span className="text-[13px]" style={{ color: SBTA.gray600 }}>
            J'accepte les conditions d'utilisation et la politique de confidentialité.
          </span>
        </label>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: '#FDECEC', color: SBTA.redDark }}>
            {error}
          </div>
        )}
      </div>
      <div className="space-y-3 p-6">
        <Button full onClick={submit} disabled={loading}>
          {loading ? 'Création...' : "S'inscrire"}
        </Button>
        <button onClick={() => navigate('/sbtamobile/login')}
          className="w-full text-center text-sm font-semibold" style={{ color: SBTA.green }}>
          Déjà inscrit ? Se connecter
        </button>
      </div>
    </div>
  );
}
