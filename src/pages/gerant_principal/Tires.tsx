import { useEffect, useState } from 'react'
import { CircleDot, Plus, Search, CreditCard as Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchTires, createTire, updateTire, fetchBuses, fetchArticles } from '@/services/stock.service'
import type { StockTire, TireStatus, BusOption, StockArticle } from '@/types/stock.types'

const STATUS_OPTIONS: { value: TireStatus; label: string; color: string; bg: string }[] = [
  { value: 'en_stock', label: 'En stock', color: '#0B7439', bg: '#E8F5EC' },
  { value: 'monte', label: 'Monté', color: '#1D6FA4', bg: '#E3F0F9' },
  { value: 'use', label: 'Usé', color: '#D97706', bg: '#FEF3C7' },
  { value: 'reforme', label: 'Réformé', color: '#AF3029', bg: '#FEF2F2' },
]

const TIRE_BRANDS = ['Michelin', 'Long-March', 'Bridgestone', 'Goodyear', 'Continental', 'Hankook', 'Pirelli', 'Autre']

function statusStyle(s: TireStatus) {
  return STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0]
}

export default function Tires() {
  const [tires, setTires] = useState<StockTire[]>([])
  const [buses, setBuses] = useState<BusOption[]>([])
  const [articles, setArticles] = useState<StockArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<StockTire | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    article_id: '' as string,
    brand: 'Michelin',
    dimension: '',
    serial_number: '',
    bus_id: '' as string,
    exit_date: '' as string,
    mileage_at_install: 0,
    status: 'en_stock' as TireStatus,
    observation: '',
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchTires({ status: statusFilter || null, brand: brandFilter || null }),
      fetchBuses(),
      fetchArticles({ item_type: 'pneu' }),
    ])
      .then(([t, b, a]) => { setTires(t); setBuses(b); setArticles(a) })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter, brandFilter])

  const filtered = search
    ? tires.filter(t =>
        t.brand.toLowerCase().includes(search.toLowerCase()) ||
        t.dimension.toLowerCase().includes(search.toLowerCase()) ||
        t.serial_number.toLowerCase().includes(search.toLowerCase()) ||
        (t.bus?.registration_number ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : tires

  const statusCounts = STATUS_OPTIONS.map(s => ({
    ...s,
    count: tires.filter(t => t.status === s.value).length,
  }))

  const openCreate = () => {
    setEditing(null)
    setForm({ article_id: '', brand: 'Michelin', dimension: '', serial_number: '', bus_id: '', exit_date: '', mileage_at_install: 0, status: 'en_stock', observation: '' })
    setShowModal(true)
  }

  const openEdit = (t: StockTire) => {
    setEditing(t)
    setForm({
      article_id: t.article_id ?? '',
      brand: t.brand,
      dimension: t.dimension,
      serial_number: t.serial_number,
      bus_id: t.bus_id ?? '',
      exit_date: t.exit_date ?? '',
      mileage_at_install: Number(t.mileage_at_install),
      status: t.status as TireStatus,
      observation: t.observation,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.brand.trim() || !form.dimension.trim()) {
      toast.error('Marque et dimension sont requises')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        article_id: form.article_id || null,
        bus_id: form.bus_id || null,
        exit_date: form.exit_date || null,
      }
      if (editing) {
        await updateTire(editing.id, payload)
        toast.success('Pneu mis à jour')
      } else {
        await createTire(payload)
        toast.success('Pneu enregistré')
      }
      setShowModal(false)
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
          <h1 className="text-2xl font-bold text-[#1A2E22]">Gestion des pneus</h1>
          <p className="text-sm text-[#6B7280] mt-1">{filtered.length} pneu(s) enregistré(s)</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0B7439] text-white rounded-xl font-medium hover:bg-[#095e2e] transition-colors">
          <Plus className="w-4 h-4" /> Nouveau pneu
        </button>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statusCounts.map(s => (
          <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? '' : s.value)}
            className={`p-4 rounded-2xl border transition-all text-left ${statusFilter === s.value ? 'ring-2 shadow-md' : ''}`}
            style={{
              backgroundColor: s.bg,
              borderColor: statusFilter === s.value ? s.color : 'transparent',
              ...(statusFilter === s.value ? { ringColor: s.color } : {}),
            }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-xs font-medium" style={{ color: s.color }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher marque, dimension, N° série, bus..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20 focus:border-[#0B7439]" />
        </div>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm">
          <option value="">Toutes marques</option>
          {TIRE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
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
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Marque</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Dimension</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">N° Série</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Bus</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Date sortie</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Km montage</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#4A6B55]">Statut</th>
                  <th className="text-center px-4 py-3 font-semibold text-[#4A6B55]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-[#8AA898]">Aucun pneu trouvé</td></tr>
                ) : filtered.map(t => {
                  const st = statusStyle(t.status as TireStatus)
                  return (
                    <tr key={t.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#1A2E22]">{t.brand}</td>
                      <td className="px-4 py-3 text-[#4A6B55]">{t.dimension}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#4A6B55]">{t.serial_number || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#0B7439]">{t.bus?.registration_number ?? '—'}</td>
                      <td className="px-4 py-3 text-[#4A6B55]">
                        {t.exit_date ? new Date(t.exit_date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-[#4A6B55]">
                        {Number(t.mileage_at_install) > 0 ? `${new Intl.NumberFormat('fr-FR').format(Number(t.mileage_at_install))} km` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg hover:bg-[#E3F0F9] text-[#1D6FA4] transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#E2EAE5]">
              <h2 className="text-lg font-bold text-[#1A2E22] flex items-center gap-2">
                <CircleDot className="w-5 h-5 text-[#D97706]" />
                {editing ? 'Modifier le pneu' : 'Nouveau pneu'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#F4F7F5]">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Marque *</label>
                  <select value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                    {TIRE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Dimension *</label>
                  <input value={form.dimension} onChange={e => setForm({ ...form, dimension: e.target.value })}
                    placeholder="ex: 295/80R22.5"
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">N° Série</label>
                  <input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TireStatus })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Article associé</label>
                <select value={form.article_id} onChange={e => setForm({ ...form, article_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                  <option value="">-- Aucun --</option>
                  {articles.map(a => <option key={a.id} value={a.id}>{a.designation} ({a.brand})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Bus assigné</label>
                <select value={form.bus_id} onChange={e => setForm({ ...form, bus_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20">
                  <option value="">-- Aucun --</option>
                  {buses.map(b => <option key={b.id} value={b.id}>{b.registration_number} - {b.brand} {b.model}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Date de sortie</label>
                  <input type="date" value={form.exit_date} onChange={e => setForm({ ...form, exit_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Km au montage</label>
                  <input type="number" min={0} value={form.mileage_at_install} onChange={e => setForm({ ...form, mileage_at_install: Number(e.target.value) })}
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
                {saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
