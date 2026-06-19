import { useEffect, useState } from 'react'
import { Plus, Pencil, X, Save, Route } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'

interface DailyRate {
  id:           string
  route_id:     string
  company_id:   string
  route_name:   string
  ticket_price: number
  daily_rate:   number
  is_active:    boolean
  notes:        string | null
  companies:    { name: string; code: string } | null
  routes:       { name: string; base_price: number } | null
}

interface RouteOption  { id: string; name: string; base_price: number }
interface CompanyOption { id: string; name: string; code: string }

function fmt(n: number) { return n.toLocaleString('fr-CI') }

const emptyForm = () => ({
  route_id: '', company_id: '', route_name: '', ticket_price: '', daily_rate: '', notes: '', is_active: true,
})

export default function DailyRatesPage() {
  const { user } = useAuthStore()
  const [rates,     setRates]    = useState<DailyRate[]>([])
  const [routes,    setRoutes]   = useState<RouteOption[]>([])
  const [companies, setComps]    = useState<CompanyOption[]>([])
  const [loading,   setLoading]  = useState(true)
  const [showModal, setShowModal]= useState(false)
  const [editId,    setEditId]   = useState<string | null>(null)
  const [form,      setForm]     = useState(emptyForm())
  const [saving,    setSaving]   = useState(false)

  const load = async () => {
    const { data, error } = await supabase
      .from('driver_daily_rates')
      .select('*, companies(name, code), routes(name, base_price)')
      .order('daily_rate', { ascending: false })
    if (error) { toast.error('Erreur de chargement'); return }
    setRates(data ?? [])
  }

  useEffect(() => {
    Promise.all([
      load(),
      supabase.from('routes').select('id, name, base_price').eq('is_active', true).order('name').then(({ data }) => setRoutes(data ?? [])),
      supabase.from('companies').select('id, name, code').order('name').then(({ data }) => setComps(data ?? [])),
    ]).finally(() => setLoading(false))
  }, [])

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setShowModal(true) }
  const openEdit = (r: DailyRate) => {
    setEditId(r.id)
    setForm({
      route_id:    r.route_id,
      company_id:  r.company_id,
      route_name:  r.route_name,
      ticket_price: String(r.ticket_price),
      daily_rate:  String(r.daily_rate),
      notes:       r.notes ?? '',
      is_active:   r.is_active,
    })
    setShowModal(true)
  }

  const onRouteChange = (routeId: string) => {
    const route = routes.find(r => r.id === routeId)
    setForm(f => ({
      ...f,
      route_id:    routeId,
      route_name:  route?.name ?? '',
      ticket_price: route?.base_price != null ? String(route.base_price) : '',
    }))
  }

  const handleSave = async () => {
    if (!form.route_id || !form.company_id || !form.daily_rate) {
      toast.error('Itinéraire, société et taux journalier sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const payload = {
        route_id:    form.route_id,
        company_id:  form.company_id,
        route_name:  form.route_name,
        ticket_price: parseFloat(form.ticket_price) || 0,
        daily_rate:  parseFloat(form.daily_rate),
        notes:       form.notes || null,
        is_active:   form.is_active,
        updated_at:  new Date().toISOString(),
        ...(editId ? {} : { created_by: user?.id ?? null }),
      }
      if (editId) {
        const { error } = await supabase.from('driver_daily_rates').update(payload).eq('id', editId)
        if (error) throw error
        toast.success('Taux mis à jour')
      } else {
        const { error } = await supabase.from('driver_daily_rates').insert(payload)
        if (error) throw error
        toast.success('Taux créé')
      }
      setShowModal(false)
      await load()
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (rate: DailyRate) => {
    const { error } = await supabase.from('driver_daily_rates')
      .update({ is_active: !rate.is_active }).eq('id', rate.id)
    if (error) { toast.error('Erreur'); return }
    await load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Taux journaliers</h1>
          <p className="text-sm text-[#6B7280] mt-1">Barème de rémunération des chauffeurs contractuels par itinéraire</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0B7439] text-white rounded-xl text-sm font-semibold hover:bg-[#085c2d] transition-colors">
          <Plus className="w-4 h-4" />
          Nouveau taux
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {rates.length === 0 ? (
          <div className="text-center py-16">
            <Route className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3 opacity-40" />
            <p className="text-[#6B7280]">Aucun taux journalier configuré</p>
            <button onClick={openCreate}
              className="mt-4 px-4 py-2 bg-[#0B7439] text-white rounded-xl text-sm font-medium hover:bg-[#085c2d]">
              Créer le premier taux
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAF8]">
              <tr>
                <th className="text-left px-6 py-3 text-[#4A6B55] font-semibold">Itinéraire</th>
                <th className="text-left px-4 py-3 text-[#4A6B55] font-semibold">Société</th>
                <th className="text-right px-4 py-3 text-[#4A6B55] font-semibold">Prix billet</th>
                <th className="text-right px-4 py-3 text-[#4A6B55] font-semibold">Taux journalier</th>
                <th className="text-right px-4 py-3 text-[#4A6B55] font-semibold">% du billet</th>
                <th className="text-center px-4 py-3 text-[#4A6B55] font-semibold">Statut</th>
                <th className="text-center px-4 py-3 text-[#4A6B55] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rates.map(rate => {
                const pct = rate.ticket_price > 0 ? (rate.daily_rate / rate.ticket_price * 100).toFixed(1) : '—'
                return (
                  <tr key={rate.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                    <td className="px-6 py-3 font-medium text-[#1A2E22]">{rate.route_name}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">
                      {(rate.companies as any)?.name ?? '—'}{' '}
                      <span className="text-xs text-[#8AA898]">({(rate.companies as any)?.code})</span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#374151]">{fmt(Number(rate.ticket_price))} F</td>
                    <td className="px-4 py-3 text-right font-bold text-[#1D6FA4]">{fmt(Number(rate.daily_rate))} F</td>
                    <td className="px-4 py-3 text-right text-[#8AA898]">{pct}%</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => toggleActive(rate)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                          rate.is_active ? 'bg-[#D4EDDA] text-[#0B7439]' : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}>
                        {rate.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openEdit(rate)}
                        className="p-1.5 rounded-lg hover:bg-[#F4F7F5] text-[#4A6B55] transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1A2E22]">{editId ? 'Modifier le taux' : 'Nouveau taux journalier'}</h3>
              <button onClick={() => setShowModal(false)} className="text-[#6B7280] hover:text-[#1A2E22]"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-[#374151]">Itinéraire *</label>
                <select value={form.route_id} onChange={e => onRouteChange(e.target.value)}
                  className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-[#0B7439]">
                  <option value="">— Sélectionner un itinéraire —</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.name} (billet : {fmt(r.base_price)} F)</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151]">Société *</label>
                <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value }))}
                  className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-[#0B7439]">
                  <option value="">— Sélectionner une société —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-[#374151]">Prix billet (FCFA)</label>
                  <input type="number" min="0" value={form.ticket_price}
                    onChange={e => setForm(f => ({ ...f, ticket_price: e.target.value }))}
                    className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-[#0B7439]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#374151]">Taux journalier (FCFA) *</label>
                  <input type="number" min="0" value={form.daily_rate}
                    onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))}
                    className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-[#0B7439]" />
                </div>
              </div>
              {form.ticket_price && form.daily_rate && (
                <div className="text-xs text-[#4A6B55] bg-[#F8FAF8] rounded-lg p-2">
                  Taux représente {(parseFloat(form.daily_rate) / parseFloat(form.ticket_price) * 100).toFixed(1)}% du prix billet
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-[#374151]">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex : Taux validé réunion Jan 2025"
                  className="w-full border border-[#E2EAE5] rounded-xl px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-[#0B7439]" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-[#0B7439]" />
                <label htmlFor="is_active" className="text-sm text-[#374151]">Taux actif</label>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-[#E2EAE5] rounded-xl text-sm text-[#6B7280] hover:bg-[#F8FAF8]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#0B7439] text-white rounded-xl font-bold text-sm hover:bg-[#085c2d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
