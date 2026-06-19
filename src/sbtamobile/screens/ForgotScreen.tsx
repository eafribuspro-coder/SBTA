import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { SBTA } from '../theme';
import { Button, Field, TopBar } from '../components';

export default function ForgotScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    if (!email.trim()) return setError('Veuillez saisir votre email.');
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/sbtamobile/login`,
      });
      setSent(true);
    } catch {
      setError("Impossible d'envoyer l'email pour le moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <TopBar title="Mot de passe oublié" onBack />
      <div className="flex-1 p-6">
        {sent ? (
          <div className="flex flex-col items-center pt-10 text-center">
            <CheckCircle2 size={56} color={SBTA.green} />
            <h2 className="mt-4 text-xl font-extrabold" style={{ color: SBTA.ink }}>
              Email envoyé
            </h2>
            <p className="mt-2 text-[15px]" style={{ color: SBTA.gray600 }}>
              Si un compte existe pour {email}, vous recevrez un lien de réinitialisation.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-5 text-[15px]" style={{ color: SBTA.gray600 }}>
              Saisissez votre email pour recevoir un lien de réinitialisation.
            </p>
            <Field label="Email" placeholder="exemple@mail.com" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} icon={<Mail size={18} color={SBTA.gray400} />} />
            {error && (
              <div className="mt-4 text-sm font-medium" style={{ color: SBTA.redDark }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-6">
        {sent ? (
          <Button full onClick={() => navigate('/sbtamobile/login')}>Retour à la connexion</Button>
        ) : (
          <Button full onClick={submit} disabled={loading}>
            {loading ? 'Envoi...' : 'Envoyer le lien'}
          </Button>
        )}
      </div>
    </div>
  );
}
