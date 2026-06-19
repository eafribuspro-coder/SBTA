import { useEffect, useState } from 'react'
import { Settings, Plus, CreditCard as Edit2, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  fetchServiceTypes, createServiceType, updateServiceType, deleteServiceType,
  fetchProviders,
} from '@/services/logistics.service'
import type { ServiceType, ServiceTypeInput, Provider } from '@/types/logistics.types'

const EMPTY: ServiceTypeInput = {
  name: '', validity_months: 12, auto_renew: false, default_amount: 0,
  default_provider_id: null, observation: null, is_active: true,
}

export default function ServiceTypes() {
  const [types, setTypes] = useState<ServiceType[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ open: boolean; editing: ServiceType | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ServiceTypeInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ServiceType | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchServiceTypes(), fetchProviders()])
      .then(([t, p]) => { setTypes(t); setProviders(p) })
      .catch((err) => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setForm(EMPTY); setModal({ open: true, editing: null }) }
  const openEdit = (t: ServiceType) => {
    setForm({
      name: t.name, validity_months: t.validity_months, auto_renew: t.auto_renew,
      default_amount: t.default_amount, default_provider_id: t.default_provider_id,
      observation: t.observation, is_active: t.is_active,
    })
    setModal({ open: true, editing: t })
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      if (modal.editing) {
        await updateServiceType(modal.editing.id, form)
        toast.success('Type de service modifié')
      } else {
        await createServiceType(form)
        toast.success('Type de service créé')
      }
      setModal({ open: false, editing: null })
      load()
    } catch (err) {
      console.error(err); toast.error('Erreur lors de l\'enregistrement')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirmDelete) return
    try {
      await deleteServiceType(confirmDelete.id)
      toast.success('Type supprimé')
      setConfirmDelete(null)
      load()
    } catch (err) { console.error(err); toast.error('Suppression impossible') }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#E7F6EC] flex items-center justify-center">
            <Settings className="w-6 h-6 text-[#0B7439]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E22]">Types de services</h1>
            <p className="text-sm text-[#6B7280]">Paramétrage des documents véhicules</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors">
          <Plus className="w-4 h-4" /> Nouveau type
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : types.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">Aucun type de service.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] text-[#4A6B55] text-left">
                  <th className="px-4 py-3 font-semibold">Nom</th>
                  <th className="px-4 py-3 font-semibold">Validité</th>
                  <th className="px-4 py-3 font-semibold">Renouv. auto</th>
                  <th className="px-4 py-3 font-semibold text-right">Montant défaut</th>
                  <th className="px-4 py-3 font-semibold">Prestataire défaut</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {types.map(t => (
                  <tr key={t.id} className="hover:bg-[#F8FAF8]">
                    <td className="px-4 py-3 font-medium text-[#1A2E22]">{t.name}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{t.validity_months > 0 ? `${t.validity_months} mois` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.auto_renew ? 'bg-[#E7F6EC] text-[#0B7439]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                        {t.auto_renew ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[#4A6B55]">{formatCurrency(t.default_amount)}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{t.default_provider_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.is_active ? 'bg-[#E7F6EC] text-[#0B7439]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                        {t.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete(t)} className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C]"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2EAE5]">
              <h2 className="font-semibold text-[#1A2E22]">{modal.editing ? 'Modifier le type' : 'Nouveau type de service'}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <Field label="Nom du service *">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Durée de validité (mois)">
                  <input type="number" min={0} value={form.validity_months} onChange={e => setForm({ ...form, validity_months: Number(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Montant par défaut">
                  <input type="number" min={0} value={form.default_amount} onChange={e => setForm({ ...form, default_amount: Number(e.target.value) })} className={inputCls} />
                </Field>
              </div>
              <Field label="Prestataire par défaut">
                <select value={form.default_provider_id ?? ''} onChange={e => setForm({ ...form, default_provider_id: e.target.value || null })} className={inputCls}>
                  <option value="">— Aucun —</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Observation">
                <textarea rows={2} value={form.observation ?? ''} onChange={e => setForm({ ...form, observation: e.target.value || null })} className={inputCls} />
              </Field>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-[#4A6B55] cursor-pointer">
                  <input type="checkbox" checked={form.auto_renew} onChange={e => setForm({ ...form, auto_renew: e.target.checked })} className="w-4 h-4 accent-[#0B7439]" />
                  Renouvellement automatique
                </label>
                <label className="flex items-center gap-2 text-sm text-[#4A6B55] cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-[#0B7439]" />
                  Actif
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#E2EAE5]">
              <button onClick={() => setModal({ open: false, editing: null })} className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8]">Annuler</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] disabled:opacity-60">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
            <h2 className="font-semibold text-[#1A2E22] mb-2">Supprimer le type</h2>
            <p className="text-sm text-[#6B7280] mb-5">Confirmer la suppression de « {confirmDelete.name} » ?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8]">Annuler</button>
              <button onClick={remove} className="px-4 py-2 rounded-xl bg-[#B91C1C] text-white text-sm font-medium hover:bg-[#991818]">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2EAE5] text-sm text-[#1A2E22] focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#4A6B55] mb-1.5">{label}</label>
      {children}
    </div>
  )
}
