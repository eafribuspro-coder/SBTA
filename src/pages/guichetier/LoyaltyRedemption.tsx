import React, { useState } from 'react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import toast from 'react-hot-toast';
import { Search, Gift, CheckCircle, XCircle, AlertTriangle, Calendar, User } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

interface Redemption {
  id: string;
  redemption_code: string;
  status: string;
  expires_at: string;
  used_at?: string;
  points_used: number;
  loyalty_rewards_catalog: {
    name: string;
    description: string;
    reward_type: string;
    reward_value: number;
    points_required: number;
  };
  customer: {
    full_name: string;
    email: string;
    phone: string;
    loyalty_tier: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'Valide', color: 'var(--primary)' },
  validee: { label: 'Validée', color: 'var(--success)' },
  utilisee: { label: 'Utilisée', color: 'var(--text-muted)' },
  annulee: { label: 'Annulée', color: 'var(--danger)' },
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  discount: 'Réduction',
  free_trip: 'Voyage gratuit',
  upgrade: 'Surclassement',
  voucher: 'Bon d\'achat',
  gift: 'Cadeau',
};

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Argent',
  gold: 'Or',
  platinum: 'Platine',
};

export default function LoyaltyRedemption() {
  const { user } = useAuthStore();
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      toast.error('Veuillez saisir un code de rédemption');
      return;
    }

    try {
      setSearching(true);
      setRedemption(null);

      const { data, error } = await supabase
        .from('loyalty_redemptions')
        .select(`
          id, redemption_code, status, expires_at, used_at, points_used,
          loyalty_rewards_catalog:reward_id(name, description, reward_type, reward_value, points_required),
          customer:customer_id(full_name, email, phone, loyalty_tier)
        `)
        .eq('redemption_code', searchCode.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Code de rédemption introuvable');
        return;
      }

      setRedemption(data as Redemption);
      toast.success('Code trouvé');
    } catch (error: any) {
      toast.error('Erreur lors de la recherche');
      console.error(error);
    } finally {
      setSearching(false);
    }
  };

  const handleValidate = async () => {
    if (!redemption) return;

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('loyalty_redemptions')
        .update({
          status: 'utilisee',
          used_at: new Date().toISOString(),
          validated_by: user?.id,
        })
        .eq('id', redemption.id);

      if (error) throw error;

      toast.success('Rédemption validée avec succès !');
      setRedemption({ ...redemption, status: 'utilisee', used_at: new Date().toISOString() });

      setTimeout(() => {
        setSearchCode('');
        setRedemption(null);
      }, 4000);
    } catch (error: any) {
      toast.error('Erreur lors de la validation');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const isExpired = redemption?.expires_at ? isPast(new Date(redemption.expires_at)) : false;
  const canValidate = redemption &&
    redemption.status === 'en_attente' &&
    !isExpired;

  const statusInfo = redemption
    ? (isExpired && redemption.status === 'en_attente'
      ? { label: 'Expiré', color: 'var(--warning)' }
      : STATUS_CONFIG[redemption.status] || { label: redemption.status, color: 'var(--text-muted)' })
    : null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Validation récompense fidélité
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Saisir le code de rédemption présenté par le client
        </p>
      </div>

      <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Code de rédemption (ex: SBTA-RDM-XXXXXX)"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 rounded-lg border text-lg font-mono"
              style={{ borderColor: 'var(--border)' }}
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchCode.trim()}
            className="px-6 py-3 rounded-lg font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>
      </div>

      {!redemption && !searching && (
        <div className="text-center py-16 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
          <Gift className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>En attente de code</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Saisissez le code de rédemption présenté par le client
          </p>
        </div>
      )}

      {redemption && statusInfo && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary-light)' }}>
                <Gift className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-black" style={{ color: 'var(--text-primary)' }}>
                  {redemption.loyalty_rewards_catalog?.name || 'Récompense'}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {REWARD_TYPE_LABELS[redemption.loyalty_rewards_catalog?.reward_type] || '—'}
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: `${statusInfo.color}18`, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="rounded-lg p-4 border">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>CLIENT</h3>
                </div>
                <p className="font-bold">{redemption.customer?.full_name || '—'}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{redemption.customer?.email}</p>
                {redemption.customer?.phone && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{redemption.customer?.phone}</p>
                )}
                <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                  {TIER_LABELS[redemption.customer?.loyalty_tier] || 'Bronze'}
                </span>
              </div>

              <div className="rounded-lg p-4 border">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>RÉCOMPENSE</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Code</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--primary)' }}>
                      {redemption.redemption_code}
                    </span>
                  </div>
                  {redemption.loyalty_rewards_catalog?.reward_value > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-muted)' }}>Valeur</span>
                      <span className="font-bold" style={{ color: 'var(--primary)' }}>
                        {redemption.loyalty_rewards_catalog.reward_type === 'discount'
                          ? `${redemption.loyalty_rewards_catalog.reward_value}%`
                          : `${redemption.loyalty_rewards_catalog.reward_value} FCFA`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Points utilisés</span>
                    <span className="font-bold">{redemption.points_used} pts</span>
                  </div>
                </div>
                {redemption.loyalty_rewards_catalog?.description && (
                  <p className="mt-3 text-xs p-2 rounded" style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                    {redemption.loyalty_rewards_catalog.description}
                  </p>
                )}
              </div>

              <div className="rounded-lg p-3 flex items-center gap-2"
                style={{ backgroundColor: isExpired ? 'var(--warning-light)' : 'var(--surface-raised)' }}>
                <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: isExpired ? 'var(--warning)' : 'var(--text-muted)' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Expiration</p>
                  <p className="text-sm font-semibold" style={{ color: isExpired ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {format(new Date(redemption.expires_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    {isExpired && ' (Expiré)'}
                  </p>
                </div>
              </div>

              {redemption.used_at && (
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  Utilisé le {format(new Date(redemption.used_at), 'dd/MM/yyyy à HH:mm')}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center justify-start gap-4">
              <div className="p-4 bg-white rounded-xl border shadow-sm">
                <QRCodeSVG value={redemption.redemption_code} size={160} level="H" includeMargin />
              </div>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>QR Code du code de rédemption</p>
            </div>
          </div>

          <div className="px-6 pb-6 space-y-3">
            {redemption.status === 'utilisee' && (
              <div className="p-4 rounded-lg flex items-start gap-3"
                style={{ backgroundColor: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Ce code a déjà été utilisé et ne peut plus être validé.
                </p>
              </div>
            )}

            {redemption.status === 'annulee' && (
              <div className="p-4 rounded-lg flex items-start gap-3"
                style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                <p className="text-sm" style={{ color: 'var(--danger)' }}>
                  Ce code a été annulé et ne peut pas être utilisé.
                </p>
              </div>
            )}

            {isExpired && redemption.status === 'en_attente' && (
              <div className="p-4 rounded-lg flex items-start gap-3"
                style={{ backgroundColor: 'var(--warning-light)', border: '1px solid var(--warning)' }}>
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                <p className="text-sm" style={{ color: 'var(--warning)' }}>
                  Ce code a expiré le {format(new Date(redemption.expires_at), 'dd/MM/yyyy')} et ne peut plus être utilisé.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setSearchCode(''); setRedemption(null); }}
                className="flex-1 py-3 rounded-xl border font-semibold text-sm"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Nouvelle recherche
              </button>
              {canValidate && (
                <button
                  onClick={handleValidate}
                  disabled={processing}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--success)' }}
                >
                  {processing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Validation...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" />Valider la rédemption</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
