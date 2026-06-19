import { useEffect, useState } from 'react'
import { Package, Plus, Search, CreditCard as Edit2, Trash2, AlertTriangle, X, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchArticles, createArticle, updateArticle, softDeleteArticle } from '@/services/stock.service'
import type { StockArticle, ItemType } from '@/types/stock.types'

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'piece', label: 'Piece' },
  { value: 'pneu', label: 'Pneu' },
  { value: 'lubrifiant', label: 'Lubrifiant' },
  { value: 'filtre', label: 'Filtre' },
  { value: 'accessoire', label: 'Accessoire' },
  { value: 'autre', label: 'Autre' },
]

const PNEU_BRANDS = ['MICHELIN', 'LONG-MARCH']

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  piece: { bg: '#E3F0F9', text: '#1D6FA4' },
  pneu: { bg: '#FEF3C7', text: '#D97706' },
  lubrifiant: { bg: '#E8F5EC', text: '#0B7439' },
  filtre: { bg: '#F3E8FF', text: '#7C3AED' },
  accessoire: { bg: '#FEE2E2', text: '#AF3029' },
  autre: { bg: '#F3F4F6', text: '#6B7280' },
}

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

function getStockStatus(stock: number, threshold: number): { label: string; bg: string; text: string; icon: typeof CheckCircle } {
  if (stock <= 0) return { label: 'Rupture', bg: '#FEE2E2', text: '#AF3029', icon: XCircle }
  if (stock <= threshold) return { label: 'Stock faible', bg: '#FEF3C7', text: '#D97706', icon: AlertTriangle }
  return { label: 'Disponible', bg: '#D1FAE5', text: '#0B7439', icon: CheckCircle }
}

const emptyForm = {
  item_type: 'piece' as ItemType,
  designation: '',
  brand: '',
  reference: '',
  category: '',
  unit_price: 0,
  alert_threshold: 5,
  supplier: '',
  observation: '',
}

export default function Articles() {
  const [articles, setArticles] = useState<StockArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StockArticle | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    fetchArticles()
      .then(setArticles)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredArticles = articles.filter(a => {
    if (typeFilter && a.item_type !== typeFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return a.designation.toLowerCase().includes(s) ||
        a.brand.toLowerCase().includes(s) ||
        a.reference.toLowerCase().includes(s)
    }
    return true
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (a: StockArticle) => {
    setEditing(a)
    setForm({
      item_type: a.item_type as ItemType,
      designation: a.designation,
      brand: a.brand,
      reference: a.reference,
      category: a.category,
      unit_price: Number(a.unit_price),
      alert_threshold: a.alert_threshold,
      supplier: a.supplier,
      observation: a.observation,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.designation.trim()) { toast.error('La designation est requise'); return }
    if (form.item_type === 'pneu' && !form.brand) { toast.error('La marque est obligatoire pour les pneus'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateArticle(editing.id, form)
        toast.success('Article mis a jour')
      } else {
        await createArticle(form)
        toast.success('Article cree')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (a: StockArticle) => {
    if (!confirm(`Desactiver "${a.designation}" ?`)) return
    try {
      await softDeleteArticle(a.id)
      toast.success('Article desactive')
      load()
    } catch {
      toast.error('Erreur de suppression')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Articles & Pieces</h1>
          <p className="text-sm text-[#6B7280] mt-1">{filteredArticles.length} article(s) au catalogue</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0B7439] text-white rounded-xl font-medium hover:bg-[#095e2e] transition-colors">
          <Plus className="w-4 h-4" /> Nouvel article
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par designation, marque, reference..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
          <option value="">Tous les types</option>
          {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] border-b border-[#E2EAE5]">
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Designation</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Marque</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Ref.</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Prix unit.</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Stock actuel</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Seuil</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#4A6B55]">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#4A6B55]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredArticles.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-[#8AA898]">Aucun article trouve</td></tr>
                ) : filteredArticles.map(a => {
                  const stock = a.computed_stock ?? 0
                  const status = getStockStatus(stock, a.alert_threshold)
                  const tc = TYPE_COLORS[a.item_type] ?? TYPE_COLORS.autre
                  return (
                    <tr key={a.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {stock <= a.alert_threshold && <AlertTriangle className="w-4 h-4 text-[#AF3029] flex-shrink-0" />}
                          <span className="font-medium text-[#1A2E22]">{a.designation}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ backgroundColor: tc.bg, color: tc.text }}>
                          {ITEM_TYPES.find(t => t.value === a.item_type)?.label ?? a.item_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#4A6B55]">{a.brand || '--'}</td>
                      <td className="px-4 py-3 text-[#4A6B55] font-mono text-xs">{a.reference || '--'}</td>
                      <td className="px-4 py-3 text-right text-[#4A6B55]">{fmt(Number(a.last_entry_price ?? a.unit_price))} F</td>
                      <td className={`px-4 py-3 text-right font-bold ${stock <= 0 ? 'text-[#AF3029]' : stock <= a.alert_threshold ? 'text-[#D97706]' : 'text-[#1A2E22]'}`}>
                        {stock}
                      </td>
                      <td className="px-4 py-3 text-right text-[#6B7280]">{a.alert_threshold}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: status.bg, color: status.text }}>
                          <status.icon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(a)}
                            className="p-1.5 rounded-lg hover:bg-[#E3F0F9] text-[#1D6FA4] transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(a)}
                            className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#AF3029] transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#E2EAE5]">
              <h2 className="text-lg font-bold text-[#1A2E22]">{editing ? 'Modifier l\'article' : 'Nouvel article'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#F4F7F5]">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Type *</label>
                  <select value={form.item_type} onChange={e => {
                    const newType = e.target.value as ItemType
                    const brandReset = newType === 'pneu' && !PNEU_BRANDS.includes(form.brand) ? '' : form.brand
                    setForm({ ...form, item_type: newType, brand: brandReset })
                  }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                    {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Designation *</label>
                  <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">
                    Marque {form.item_type === 'pneu' && <span className="text-[#AF3029]">*</span>}
                  </label>
                  {form.item_type === 'pneu' ? (
                    <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                      <option value="">-- Selectionner la marque --</option>
                      {PNEU_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Reference</label>
                  <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Categorie</label>
                  <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Fournisseur</label>
                  <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Prix unitaire par defaut (FCFA)</label>
                  <input type="number" min={0} value={form.unit_price}
                    onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Seuil d'alerte</label>
                  <input type="number" min={0} value={form.alert_threshold}
                    onChange={e => setForm({ ...form, alert_threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Observation</label>
                <textarea value={form.observation} onChange={e => setForm({ ...form, observation: e.target.value })} rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#E2EAE5]">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#E2EAE5] text-sm font-medium text-[#4A6B55] hover:bg-[#F8FAF8]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2e] disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement...' : editing ? 'Mettre a jour' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
