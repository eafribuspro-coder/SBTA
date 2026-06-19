import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, HelpCircle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchFaqs, saveFaq, deleteFaq, type Faq } from '@/services/agentReservation.service';
import { useRealtimeSync } from './shared';

const CATEGORIES = ['general', 'reservation', 'paiement', 'annulation', 'compte'];
const CATEGORY_LABELS: Record<string, string> = {
  general: 'Général',
  reservation: 'Réservation',
  paiement: 'Paiement',
  annulation: 'Annulation',
  compte: 'Compte',
};

type Draft = Partial<Faq> & { id?: string };

export default function FaqPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    fetchFaqs()
      .then(setFaqs)
      .catch((e) => { console.error(e); toast.error('Erreur lors du chargement des FAQ'); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useRealtimeSync(['reservation_faqs'], load);

  const handleSave = async () => {
    if (!draft?.question?.trim() || !draft?.answer?.trim()) { toast.error('Question et réponse requises'); return; }
    setSaving(true);
    try {
      await saveFaq(draft);
      toast.success(draft.id ? 'FAQ modifiée' : 'FAQ ajoutée');
      setDraft(null);
      load();
    } catch (e) {
      console.error(e);
      toast.error('Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: Faq) => {
    if (!window.confirm(`Supprimer cette FAQ ?\n\n"${f.question}"`)) return;
    try {
      await deleteFaq(f.id);
      toast.success('FAQ supprimée');
      load();
    } catch (e) {
      console.error(e);
      toast.error('Suppression impossible');
    }
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Gestion FAQ</h1>
          <p className="text-sm text-[#6B7280] mt-1">Questions fréquentes affichées dans l'application mobile</p>
        </div>
        <button
          onClick={() => setDraft({ category: 'general', display_order: faqs.length, is_active: true })}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Plus className="w-4 h-4" /> Nouvelle FAQ
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-9 h-9 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : faqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <HelpCircle className="w-10 h-10 mb-2 text-[#C5D6CC]" />
            <p className="text-sm">Aucune FAQ pour le moment.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F4F1]">
            {faqs.map((f) => (
              <div key={f.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setOpenId(openId === f.id ? null : f.id)}
                    className="flex-1 flex items-start gap-3 text-left"
                  >
                    <ChevronDown className={'w-4 h-4 mt-1 text-[#8AA898] transition-transform ' + (openId === f.id ? 'rotate-180' : '')} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A2E22]">{f.question}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#F1F5F2] text-[#6B7280]">{CATEGORY_LABELS[f.category] ?? f.category}</span>
                        {!f.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C]">Masquée</span>}
                      </div>
                      {openId === f.id && <p className="text-sm text-[#4A6B55] mt-2 leading-relaxed">{f.answer}</p>}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setDraft(f)} title="Modifier" className="p-1.5 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(f)} title="Supprimer" className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDraft(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2EAE5] sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-[#1A2E22]">{draft.id ? 'Modifier la FAQ' : 'Nouvelle FAQ'}</h2>
              <button onClick={() => setDraft(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-[#8AA898]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Question</label>
                <input
                  value={draft.question ?? ''}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Réponse</label>
                <textarea
                  value={draft.answer ?? ''}
                  onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
                  rows={4}
                  className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Catégorie</label>
                  <select
                    value={draft.category ?? 'general'}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                    className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A2E22] mb-1.5">Ordre d'affichage</label>
                  <input
                    type="number"
                    min={0}
                    value={draft.display_order ?? 0}
                    onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })}
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
                Visible dans l'application mobile
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
