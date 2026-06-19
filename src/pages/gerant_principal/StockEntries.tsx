import { useEffect, useState, useRef } from 'react'
import { ArrowDownCircle, Plus, Search, X, Calendar, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchEntries, createEntry, fetchArticles } from '@/services/stock.service'
import type { StockEntry, StockArticle } from '@/types/stock.types'

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

export default function StockEntries() {
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [articles, setArticles] = useState<StockArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [articleSearch, setArticleSearch] = useState('')
  const [showArticleDropdown, setShowArticleDropdown] = useState(false)
  const articleDropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    article_id: '',
    entry_date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    unit_price: 0,
    supplier: '',
    invoice_number: '',
    observation: '',
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchEntries({ date_from: dateFrom || null, date_to: dateTo || null }),
      fetchArticles(),
    ])
      .then(([e, a]) => { setEntries(e); setArticles(a) })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (articleDropdownRef.current && !articleDropdownRef.current.contains(e.target as Node)) {
        setShowArticleDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = search
    ? entries.filter(e =>
        (e.article?.designation ?? '').toLowerCase().includes(search.toLowerCase()) ||
        e.supplier.toLowerCase().includes(search.toLowerCase()) ||
        e.invoice_number.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  const totalQty = filtered.reduce((s, e) => s + e.quantity, 0)
  const totalVal = filtered.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)

  const selectedArticle = articles.find(a => a.id === form.article_id)

  const articleResults = articleSearch.trim().length > 0
    ? articles.filter(a => {
        const s = articleSearch.toLowerCase()
        return a.designation.toLowerCase().includes(s) ||
          a.reference.toLowerCase().includes(s) ||
          a.brand.toLowerCase().includes(s) ||
          a.category.toLowerCase().includes(s)
      }).slice(0, 10)
    : articles.slice(0, 10)

  const handleArticleSelect = (article: StockArticle) => {
    setForm(prev => ({ ...prev, article_id: article.id, unit_price: Number(article.unit_price) }))
    setArticleSearch(article.designation)
    setShowArticleDropdown(false)
  }

  const clearArticle = () => {
    setForm(prev => ({ ...prev, article_id: '', unit_price: 0 }))
    setArticleSearch('')
  }

  const handleSave = async () => {
    if (!form.article_id) { toast.error('Sélectionnez un article'); return }
    if (form.quantity <= 0) { toast.error('La quantité doit être supérieure à 0'); return }
    setSaving(true)
    try {
      await createEntry(form)
      toast.success('Entrée enregistrée')
      setShowModal(false)
      setForm({ article_id: '', entry_date: new Date().toISOString().slice(0, 10), quantity: 1, unit_price: 0, supplier: '', invoice_number: '', observation: '' })
      setArticleSearch('')
      load()
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Entrées de stock</h1>
          <p className="text-sm text-[#6B7280] mt-1">{filtered.length} entrée(s) -- Total: {fmt(totalQty)} unités, {fmt(totalVal)} FCFA</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1D6FA4] text-white rounded-xl font-medium hover:bg-[#175f8f] transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle entrée
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher article, fournisseur, facture..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20 focus:border-[#1D6FA4]" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#8AA898]" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm" />
          <span className="text-[#8AA898]">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-[#1D6FA4] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] border-b border-[#E2EAE5]">
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Article</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Fournisseur</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">N° Facture</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Qté</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Prix unit.</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-[#8AA898]">Aucune entrée trouvée</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                    <td className="px-4 py-3 text-[#1A2E22] font-medium">
                      {new Date(e.entry_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1A2E22]">{e.article?.designation ?? '—'}</p>
                      <p className="text-xs text-[#6B7280]">{e.article?.brand} {e.article?.reference && `- ${e.article.reference}`}</p>
                    </td>
                    <td className="px-4 py-3 text-[#4A6B55]">{e.supplier || '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55] font-mono text-xs">{e.invoice_number || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B7439]">+{e.quantity}</td>
                    <td className="px-4 py-3 text-right text-[#4A6B55]">{fmt(Number(e.unit_price))} F</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0B7439]">{fmt(Number(e.total_amount))} F</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-[#E8F5EC] border-t-2 border-[#0B7439]">
                    <td colSpan={4} className="px-4 py-3 font-bold text-[#0B7439]">TOTAL</td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B7439]">{fmt(totalQty)}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-bold text-[#0B7439]">{fmt(totalVal)} F</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-[#E2EAE5]">
              <h2 className="text-lg font-bold text-[#1A2E22] flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-[#1D6FA4]" /> Nouvelle entrée
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#F4F7F5]">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Article autocomplete */}
              <div ref={articleDropdownRef} className="relative">
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Article *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
                  <input
                    value={articleSearch}
                    onChange={e => {
                      setArticleSearch(e.target.value)
                      setShowArticleDropdown(true)
                      if (form.article_id) {
                        setForm(prev => ({ ...prev, article_id: '', unit_price: 0 }))
                      }
                    }}
                    onFocus={() => setShowArticleDropdown(true)}
                    placeholder="Rechercher par nom, référence, marque, catégorie..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20 focus:border-[#1D6FA4]"
                  />
                  {form.article_id && (
                    <button onClick={clearArticle} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[#F4F7F5]">
                      <X className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  )}
                </div>

                {showArticleDropdown && !form.article_id && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#E2EAE5] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {articleResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[#8AA898]">Aucun article trouvé</div>
                    ) : articleResults.map(a => {
                      const stock = a.computed_stock ?? 0
                      const isLow = stock <= a.alert_threshold
                      const isZero = stock <= 0
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleArticleSelect(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAF8] transition-colors border-b border-[#E2EAE5] last:border-b-0 flex items-start gap-3"
                        >
                          <Package className="w-4 h-4 mt-0.5 text-[#8AA898] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm text-[#1A2E22] truncate">{a.designation}</span>
                              <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ${
                                isZero ? 'bg-[#FEE2E2] text-[#AF3029]' : isLow ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#D1FAE5] text-[#0B7439]'
                              }`}>
                                {stock} en stock
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {a.brand && <span className="text-xs text-[#6B7280]">{a.brand}</span>}
                              {a.reference && <span className="text-xs text-[#8AA898]">Réf: {a.reference}</span>}
                              {a.category && <span className="text-xs text-[#8AA898]">- {a.category}</span>}
                            </div>
                            <div className="text-xs text-[#6B7280] mt-0.5">{fmt(Number(a.unit_price))} FCFA / unité</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedArticle && (
                  <div className="mt-2 rounded-xl p-3 bg-[#E3F0F9] border border-[#93C5FD] flex items-start gap-3">
                    <Package className="w-5 h-5 mt-0.5 shrink-0 text-[#1D6FA4]" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1A2E22]">{selectedArticle.designation}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {selectedArticle.brand && <span className="text-xs text-[#4A6B55]">Marque: {selectedArticle.brand}</span>}
                        {selectedArticle.reference && <span className="text-xs text-[#4A6B55]">Réf: {selectedArticle.reference}</span>}
                        <span className="text-xs text-[#4A6B55]">Prix: {fmt(Number(selectedArticle.unit_price))} FCFA</span>
                        <span className="text-xs font-bold text-[#1D6FA4]">Stock actuel: {selectedArticle.computed_stock ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Date *</label>
                  <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Quantité *</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" min={0} value={form.unit_price} onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">N° Facture</label>
                  <input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Fournisseur</label>
                <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Observation</label>
                <textarea value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#1D6FA4]/20 resize-none" />
              </div>
              {form.quantity > 0 && form.unit_price > 0 && (
                <div className="bg-[#E3F0F9] rounded-xl p-3 text-center">
                  <p className="text-sm text-[#1D6FA4]">Total: <strong>{fmt(form.quantity * form.unit_price)} FCFA</strong></p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#E2EAE5]">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#E2EAE5] text-sm font-medium text-[#4A6B55] hover:bg-[#F8FAF8]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#1D6FA4] text-white text-sm font-medium hover:bg-[#175f8f] disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
