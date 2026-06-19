import { useEffect, useState } from 'react';
import { Save, Wallet, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/formatCurrency';
import { fetchServiceFee, updateServiceFee } from '@/services/agentReservation.service';
import { useRealtimeSync } from './shared';

export default function Settings() {
  const [fee, setFee] = useState<number>(300);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchServiceFee()
      .then(setFee)
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des paramètres'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['mobile_app_settings'], load);

  const save = async () => {
    if (fee < 0 || isNaN(fee)) { toast.error('Montant invalide'); return; }
    setSaving(true);
    try {
      await updateServiceFee(fee);
      toast.success('Frais de service mis à jour');
    } catch (e) {
      console.error(e);
      toast.error('Échec de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const samplePrice = 5000;

  return (
    <div className="space-y-5 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E22]">Paramétrage des frais de service</h1>
        <p className="text-sm text-[#6B7280] mt-1">Frais ajoutés au prix du billet lors du paiement mobile</p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#E7F6EC] flex items-center justify-center flex-shrink-0">
            <Wallet className="w-6 h-6 text-[#0B7439]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#1A2E22]">Frais de service fixe</h2>
            <p className="text-sm text-[#6B7280]">Appliqué à chaque billet réservé sur l'application mobile</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Montant des frais (FCFA)</label>
          <input
            type="number"
            min={0}
            step={50}
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
            className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
          />
        </div>

        <div className="rounded-xl bg-[#F8FAF8] border border-[#E2EAE5] p-4 flex gap-3">
          <Info className="w-4 h-4 text-[#0B7439] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#4A6B55] space-y-1">
            <p className="font-medium text-[#1A2E22]">Impact sur le paiement mobile</p>
            <p>Prix du billet : <span className="font-medium">{formatCurrency(samplePrice)}</span></p>
            <p>Frais de service : <span className="font-medium">{formatCurrency(fee)}</span></p>
            <p className="pt-1 border-t border-[#E2EAE5] text-[#0B7439] font-semibold">
              Total à payer : {formatCurrency(samplePrice + fee)}
            </p>
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Save className="w-4 h-4" /> {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
