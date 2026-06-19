import { useEffect, useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck, Clock, Loader2 } from 'lucide-react';
import { SBTA } from '../theme';
import { Card, BottomNav } from '../components';
import { fetchFaqs, fetchPolicies, type Faq, type CancellationPolicy } from '../api';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'Général',
  reservation: 'Réservation',
  paiement: 'Paiement',
  annulation: 'Annulation',
  compte: 'Compte',
};

function refundColor(rate: number) {
  if (rate >= 75) return { bg: SBTA.greenLight, text: SBTA.greenDark };
  if (rate >= 25) return { bg: '#FFF8E6', text: '#7A5C00' };
  return { bg: '#FDECEC', text: SBTA.redDark };
}

export default function HelpScreen() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchFaqs(), fetchPolicies()])
      .then(([f, p]) => { setFaqs(f); setPolicies(p); })
      .catch(() => setError("Impossible de charger l'aide."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 pb-5 pt-12" style={{ background: `linear-gradient(160deg, ${SBTA.green}, ${SBTA.greenDark})` }}>
        <h1 className="text-2xl font-extrabold text-white">Aide & FAQ</h1>
        <p className="text-sm text-white opacity-90">Questions fréquentes et conditions d'annulation</p>
      </div>

      <div className="flex-1 space-y-5 px-6 pb-6 pt-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={26} className="animate-spin" color={SBTA.green} />
          </div>
        ) : error ? (
          <Card>
            <p className="py-4 text-center text-sm" style={{ color: SBTA.redDark }}>{error}</p>
          </Card>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} color={SBTA.green} />
                <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SBTA.gray600 }}>
                  Questions fréquentes
                </h2>
              </div>
              {faqs.length === 0 ? (
                <Card>
                  <p className="py-3 text-center text-sm" style={{ color: SBTA.gray400 }}>
                    Aucune question pour le moment.
                  </p>
                </Card>
              ) : (
                faqs.map((f) => {
                  const open = openId === f.id;
                  return (
                    <Card key={f.id}>
                      <button
                        onClick={() => setOpenId(open ? null : f.id)}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-semibold" style={{ color: SBTA.ink }}>{f.question}</p>
                          <span
                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ background: SBTA.gray100, color: SBTA.gray600 }}
                          >
                            {CATEGORY_LABELS[f.category] ?? f.category}
                          </span>
                          {open && (
                            <p className="mt-2 text-sm leading-relaxed" style={{ color: SBTA.gray600 }}>{f.answer}</p>
                          )}
                        </div>
                        <ChevronDown
                          size={18}
                          color={SBTA.gray400}
                          className="mt-1 shrink-0 transition-transform"
                          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
                        />
                      </button>
                    </Card>
                  );
                })
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} color={SBTA.green} />
                <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: SBTA.gray600 }}>
                  Politique d'annulation
                </h2>
              </div>
              {policies.length === 0 ? (
                <Card>
                  <p className="py-3 text-center text-sm" style={{ color: SBTA.gray400 }}>
                    Aucune règle d'annulation définie.
                  </p>
                </Card>
              ) : (
                policies.map((p) => {
                  const c = refundColor(p.refund_rate);
                  return (
                    <Card key={p.id}>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold" style={{ color: SBTA.ink }}>{p.title}</h3>
                        <span
                          className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {p.refund_rate}% remboursé
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: SBTA.gray600 }}>
                        <Clock size={15} color={SBTA.gray400} />
                        {p.hours_before_departure}h avant le départ
                      </div>
                      {p.description && (
                        <p className="mt-2 text-sm leading-relaxed" style={{ color: SBTA.gray600 }}>{p.description}</p>
                      )}
                    </Card>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
