import { useEffect, useState } from 'react'
import { Building2, Plus, CreditCard as Edit2, Trash2, X, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchProviders, createProvider, updateProvider, deleteProvider, fetchServiceTypes,
} from '@/services/logistics.service'
import type { Provider, ProviderInput, ServiceType } from '@/types/logistics.types'

const EMPTY: ProviderInput = {
  name: '', service_type: null, contact: null, phone: null, email: null,
  address: null, rates: null, observation: null, is_active: true,
}

export default function Providers() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; editing: Provider | null }>({ open: false, editing: null })
  const [form, setForm] = useState<ProviderInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Provider | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchProviders(), fetchServiceTypes()])
      .then(([p, s]) => { setProviders(p); setServiceTypes(s) })
      .catch((err) => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setForm(EMPTY); setModal({ open: true, editing: null }) }
  const openEdit = (p: Provider) => {
    setForm({
      name: p.name, service_type: p.service_type, contact: p.contact, phone: p.phone,
      email: p.email, address: p.address, rates: p.rates, observation: p.observation, is_active: p.is_active,
    })
    setModal({ open: true, editing: p })
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Le nom est obligatoire'); return }
    setSaving(true)
    try {
      if (modal.editing) { await updateProvider(modal.editing.id, form); toast.success('Prestataire modifié') }
      else { await createProvider(form); toast.success('Prestataire créé') }
      setModal({ open: false, editing: null }); load()
    } catch (err) { console.error(err); toast.error('Erreur lors de l\'enregistrement') }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirmDelete) return
    try { await deleteProvider(confirmDelete.id); toast.success('Prestataire supprimé'); setConfirmDelete(null); load() }
    catch (err) { console.error(err); toast.error('Suppression impossible') }
  }

  const filtered = providers.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return [p.name, p.service_type, p.contact, p.phone, p.email].some(v => (v ?? '').toLowerCase().includes(q))
  })

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#E7F6EC] flex items-center justify-center">
            <Building2 className="w-6 h-6 text-[#0B7439]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E22]">Prestataires logistiques</h1>
            <p className="text-sm text-[#6B7280]">Mayelia, SICTA, District, etc.</p>
          </div>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors">
          <Plus className="w-4 h-4" /> Nouveau prestataire
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30" />
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">Aucun prestataire.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] text-[#4A6B55] text-left">
                  <th className="px-4 py-3 font-semibold">Nom</th>
                  <th className="px-4 py-3 font-semibold">Type de service</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Téléphone</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-[#F8FAF8]">
                    <td className="px-4 py-3 font-medium text-[#1A2E22]">{p.name}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{p.service_type || '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{p.contact || '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{p.phone || '—'}</td>
                    <td className="px-4 py-3 text-[#4A6B55]">{p.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_active ? 'bg-[#E7F6EC] text-[#0B7439]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>{p.is_active ? 'Actif' : 'Inactif'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439]"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setConfirmDelete(p)} className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C]"><Trash2 className="w-4 h-4" /></button>
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
              <h2 className="font-semibold text-[#1A2E22]">{modal.editing ? 'Modifier le prestataire' : 'Nouveau prestataire'}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <Field label="Nom *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Type de service"><select value={form.service_type ?? ''} onChange={e => setForm({ ...form, service_type: e.target.value || null })} className={inputCls}><option value="">— Aucun —</option>{serviceTypes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact"><input value={form.contact ?? ''} onChange={e => setForm({ ...form, contact: e.target.value || null })} className={inputCls} /></Field>
                <Field label="Téléphone"><input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value || null })} className={inputCls} /></Field>
              </div>
              <Field label="Email"><input type="email" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value || null })} className={inputCls} /></Field>
              <Field label="Adresse"><input value={form.address ?? ''} onChange={e => setForm({ ...form, address: e.target.value || null })} className={inputCls} /></Field>
              <Field label="Montants pratiqués"><textarea rows={2} value={form.rates ?? ''} onChange={e => setForm({ ...form, rates: e.target.value || null })} className={inputCls} /></Field>
              <Field label="Observation"><textarea rows={2} value={form.observation ?? ''} onChange={e => setForm({ ...form, observation: e.target.value || null })} className={inputCls} /></Field>
              <label className="flex items-center gap-2 text-sm text-[#4A6B55] cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-[#0B7439]" /> Actif
              </label>
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
            <h2 className="font-semibold text-[#1A2E22] mb-2">Supprimer le prestataire</h2>
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
  return (<div><label className="block text-xs font-medium text-[#4A6B55] mb-1.5">{label}</label>{children}</div>)
}