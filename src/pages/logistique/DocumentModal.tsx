import { useEffect, useRef, useState } from 'react'
import { X, Upload, FileText, Search, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createDocument, updateDocument, renewDocument, uploadLogisticsDocument, computeExpiry,
  ensureVehicleForBus,
} from '@/services/logistics.service'
import type {
  Vehicle, ServiceType, Provider, VehicleDocument, VehicleDocumentInput,
} from '@/types/logistics.types'

export type DocModalMode = 'create' | 'edit' | 'renew'

interface Props {
  mode:         DocModalMode
  vehicles:     Vehicle[]
  serviceTypes: ServiceType[]
  providers:    Provider[]
  existing?:    VehicleDocument | null
  lockedVehicleId?: string | null
  onClose:      () => void
  onSaved:      () => void
}

const currentYear = new Date().getFullYear()

function emptyForm(vehicleId: string | null): VehicleDocumentInput {
  return {
    vehicle_id: vehicleId, service_type_id: null, service_type_name: '',
    provider_id: null, provider_name: null, year_concerned: currentYear,
    issue_date: null, expiry_date: null, amount: 0, document_url: null, observation: null,
  }
}

export default function DocumentModal({ mode, vehicles, serviceTypes, providers, existing, lockedVehicleId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<VehicleDocumentInput>(() => {
    if (existing && (mode === 'edit' || mode === 'renew')) {
      return {
        vehicle_id: existing.vehicle_id, service_type_id: existing.service_type_id,
        service_type_name: existing.service_type_name, provider_id: existing.provider_id,
        provider_name: existing.provider_name,
        year_concerned: mode === 'renew' ? currentYear : existing.year_concerned,
        issue_date: mode === 'renew' ? null : existing.issue_date,
        expiry_date: mode === 'renew' ? null : existing.expiry_date,
        amount: existing.amount, document_url: mode === 'renew' ? null : existing.document_url,
        observation: existing.observation,
      }
    }
    return emptyForm(lockedVehicleId ?? null)
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // auto-compute expiry from issue date + service type validity
  useEffect(() => {
    if (!form.issue_date || !form.service_type_id) return
    const st = serviceTypes.find(s => s.id === form.service_type_id)
    if (st && st.validity_months > 0) {
      const exp = computeExpiry(form.issue_date, st.validity_months)
      setForm(f => ({ ...f, expiry_date: exp }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.issue_date, form.service_type_id])

  const onPickServiceType = (id: string) => {
    const st = serviceTypes.find(s => s.id === id)
    setForm(f => ({
      ...f,
      service_type_id: id || null,
      service_type_name: st?.name ?? f.service_type_name,
      amount: st && f.amount === 0 ? st.default_amount : f.amount,
      provider_id: st?.default_provider_id ?? f.provider_id,
      provider_name: st?.default_provider_name ?? f.provider_name,
    }))
  }

  const onPickProvider = (id: string) => {
    const p = providers.find(x => x.id === id)
    setForm(f => ({ ...f, provider_id: id || null, provider_name: p?.name ?? null }))
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadLogisticsDocument(file)
      setForm(f => ({ ...f, document_url: url }))
      toast.success('Document téléchargé')
    } catch (err) { console.error(err); toast.error('Échec du téléchargement') }
    finally { setUploading(false) }
  }

  const save = async () => {
    if (!form.vehicle_id) { toast.error('Sélectionnez un véhicule'); return }
    if (!form.service_type_name.trim()) { toast.error('Sélectionnez un type de service'); return }
    setSaving(true)
    try {
      let payload = form
      if (form.vehicle_id?.startsWith('bus:')) {
        const vehicleId = await ensureVehicleForBus(form.vehicle_id.slice(4))
        payload = { ...form, vehicle_id: vehicleId }
      }
      if (mode === 'edit' && existing) { await updateDocument(existing.id, payload); toast.success('Document modifié') }
      else if (mode === 'renew' && existing) { await renewDocument(existing.id, payload); toast.success('Document renouvelé') }
      else { await createDocument(payload); toast.success('Document enregistré') }
      onSaved()
    } catch (err) { console.error(err); toast.error('Erreur lors de l\'enregistrement') }
    finally { setSaving(false) }
  }

  const title = mode === 'renew' ? 'Renouveler le document' : mode === 'edit' ? 'Modifier le document' : 'Nouveau document'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2EAE5]">
          <h2 className="font-semibold text-[#1A2E22]">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F4F6]"><X className="w-5 h-5 text-[#6B7280]" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {mode === 'renew' && (
            <div className="text-xs px-3 py-2 rounded-lg bg-[#DBEAFE] text-[#1D4ED8]">
              L'ancien document sera conservé dans l'historique.
            </div>
          )}
          <Field label="Véhicule *">
            <VehicleAutocomplete
              vehicles={vehicles}
              value={form.vehicle_id}
              disabled={!!lockedVehicleId || mode !== 'create'}
              onChange={id => setForm({ ...form, vehicle_id: id })}
            />
          </Field>
          <Field label="Type de service *">
            <select value={form.service_type_id ?? ''} onChange={e => onPickServiceType(e.target.value)} className={inputCls}>
              <option value="">— Sélectionner —</option>
              {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Année concernée">
              <input type="number" value={form.year_concerned ?? ''} onChange={e => setForm({ ...form, year_concerned: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
            </Field>
            <Field label="Prestataire">
              <select value={form.provider_id ?? ''} onChange={e => onPickProvider(e.target.value)} className={inputCls}>
                <option value="">— Aucun —</option>
                {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date d'établissement">
              <input type="date" value={form.issue_date ?? ''} onChange={e => setForm({ ...form, issue_date: e.target.value || null })} className={inputCls} />
            </Field>
            <Field label="Date d'expiration">
              <input type="date" value={form.expiry_date ?? ''} onChange={e => setForm({ ...form, expiry_date: e.target.value || null })} className={inputCls} />
            </Field>
          </div>
          <Field label="Montant">
            <input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Document (image/PDF)">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2EAE5] text-sm text-[#4A6B55] cursor-pointer hover:bg-[#F8FAF8]">
                <Upload className="w-4 h-4" /> {uploading ? 'Envoi...' : 'Choisir un fichier'}
                <input type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={onFile} className="hidden" />
              </label>
              {form.document_url && (
                <a href={form.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-[#0B7439] hover:underline">
                  <FileText className="w-4 h-4" /> Voir
                </a>
              )}
            </div>
          </Field>
          <Field label="Observation">
            <textarea rows={2} value={form.observation ?? ''} onChange={e => setForm({ ...form, observation: e.target.value || null })} className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#E2EAE5]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8]">Annuler</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] disabled:opacity-60">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-[#E2EAE5] text-sm text-[#1A2E22] focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] disabled:bg-[#F3F4F6]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><label className="block text-xs font-medium text-[#4A6B55] mb-1.5">{label}</label>{children}</div>)
}

function vehicleLabel(v: Vehicle): string {
  const plate = v.registration_number || v.provisional_number || 'Sans plaque'
  const info = [v.brand, v.model].filter(Boolean).join(' ')
  return info ? `${plate} · ${info}` : plate
}

function VehicleAutocomplete({ vehicles, value, disabled, onChange }: {
  vehicles: Vehicle[]
  value: string | null
  disabled: boolean
  onChange: (id: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selected = vehicles.find(v => v.id === value)

  useEffect(() => {
    if (selected && !open) setQuery('')
  }, [selected, open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = vehicles.filter(v => {
    if (!query) return true
    const q = query.toLowerCase()
    return [v.registration_number, v.provisional_number, v.brand, v.model, v.chassis_number]
      .some(f => (f ?? '').toLowerCase().includes(q))
  })

  if (disabled && selected) {
    return (
      <div className={inputCls + ' bg-[#F3F4F6] cursor-not-allowed'}>
        <span className="font-mono font-semibold text-[#0B7439]">{vehicleLabel(selected)}</span>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={`flex items-center gap-2 ${inputCls} cursor-text`}
        onClick={() => { if (!disabled) setOpen(true) }}
      >
        <Search className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
        <input
          type="text"
          value={open ? query : (selected ? vehicleLabel(selected) : '')}
          placeholder="Rechercher par plaque, marque, modèle..."
          disabled={disabled}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { if (!disabled) setOpen(true) }}
          className="flex-1 bg-transparent outline-none text-sm text-[#1A2E22] placeholder:text-[#9CA3AF] disabled:cursor-not-allowed"
        />
        <ChevronDown className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-[#E2EAE5] rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setQuery(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-[#6B7280] hover:bg-[#F8FAF8] border-b border-[#F0F4F1]"
            >
              — Aucun véhicule —
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-[#6B7280] text-center">
              Aucun véhicule trouvé pour « {query} »
            </div>
          ) : (
            filtered.slice(0, 50).map(v => {
              const isSelected = v.id === value
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onChange(v.id); setQuery(''); setOpen(false) }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-[#F8FAF8] transition-colors flex items-center gap-3 ${isSelected ? 'bg-[#E7F6EC]' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-semibold text-[#0B7439] text-sm">
                      {v.registration_number || v.provisional_number || 'Sans plaque'}
                    </span>
                    {(v.brand || v.model) && (
                      <span className="text-xs text-[#6B7280] ml-2">
                        {[v.brand, v.model].filter(Boolean).join(' ')}
                      </span>
                    )}
                    {v.company_name && (
                      <span className="text-xs text-[#8AA898] ml-2">{v.company_name}</span>
                    )}
                  </div>
                  {v.chassis_number && (
                    <span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{v.chassis_number}</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
