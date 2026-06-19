import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ShieldCheck, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPolicies, savePolicy, deletePolicy, type CancellationPolicy } from '@/services/agentReservation.service';
import { useRealtimeSync } from './shared';

type Draft = Partial<CancellationPolicy> & { id?: string };

export default function CancellationPolicies() {
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchPolicies()
      .then(setPolicies)
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des politiques'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['cancellation_policies'], load);

  const handleSave = async () => {
    if (!draft?.title?.trim()) { toast.error('Le titre est requis'); return; }
    const rate = draft.refund_rate ?? 0;
    if (rate < 0 || rate > 100) { toast.error('Le taux doit être entre 0 et 100'); return; }
    setSaving(true);
    try {
      await savePolicy(draft);
      toast.success(draft.id ? 'Politique modifiée' : 'Politique ajoutée');
      setDraft(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: CancellationPolicy) => {
    if (!window.confirm(`Supprimer la politique "${p.title}" ?`)) return;
    try {
      await deletePolicy(p.id);
      toast.success('Politique supprimée');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Suppression impossible');
    }
  };

  const refundColor = (rate: number) =>
    rate >= 75 ? { bg: '#E7F6EC', text: '#0B7439' } : rate >= 25 ? { bg: '#FEF3C7', text: '#B45309' } : { bg: '#FEE2E2', text: '#B91C1C' };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Politique d'annulation</h1>
          <p className="text-sm text-[#6B7280] mt-1">Règles de remboursement appliquées dans l'application mobile</p>
        </div>
        <button
          onClick={() => setDraft({ hours_before_departure: 24, refund_rate: 50, is_active: true })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Plus className="w-4 h-4" /> Nouvelle règle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-9 h-9 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] flex flex-col items-center justify-center py-16 text-[#6B7280]">
          <ShieldCheck className="w-10 h-10 mb-2 text-[#C5D6CC]" />
          <p className="text-sm">Aucune politique définie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {policies.map((p) => {
            const c = refundColor(p.refund_rate);
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-[#E2EAE5] p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[#1A2E22]">{p.title}</h3>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap" style={{ backgroundColor: c.bg, color: c.text }}>
                    {p.refund_rate}% remboursé
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-[#4A6B55] mt-2">
                  <Clock className="w-4 h-4 text-[#8AA898]" />
                  {p.hours_before_departure}h avant le départ
                </div>
                {p.description && <p className="text-sm text-[#6B7280] mt-2 flex-1">{p.description}</p>}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#F0F4F1]">
                  {!p.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C]">Inactive</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setDraft(p)} title="Modifier" className="p-1.5 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2EAE5] sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-[#1A2E22]">{draft.id ? 'Modifier la règle' : 'Nouvelle règle'}</h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-[#8AA898]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Titre</label>
                <input
                  value={draft.title ?? ''}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Ex : Annulation 48h avant"
                  className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Description</label>
                <textarea
                  value={draft.description ?? ''}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Heures avant départ</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.hours_before_departure ?? 0}
                    onChange={(e) => setDraft({ ...draft, hours_before_departure: Number(e.target.value) })}
                    className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Taux remboursement (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.refund_rate ?? 0}
                    onChange={(e) => setDraft({ ...draft, refund_rate: Number(e.target.value) })}
                    className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#4A6B55] cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.is_active ?? true}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="w-4 h-4 accent-[#0B7439]"
                />
                Active dans l'application mobile
              </label>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#0B7439' }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
