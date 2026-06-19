import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Building2, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchInsurers, createInsurer, updateInsurer, INSURER_TYPE_LABELS,
} from '@/services/insurance.service'
import type { InsurerInput, InsurerType, InsurerStatus } from '@/types/insurance.types'

const EMPTY: InsurerInput = {
  name: '',
  acronym: null,
  approval_number: null,
  type: 'automobile',
  status: 'actif',
  contact_last_name: null,
  contact_first_name: null,
  contact_role: null,
  phone_primary: null,
  phone_secondary: null,
  whatsapp: null,
  email: null,
  website: null,
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#6B7280] mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function InsurerForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)

  const [form, setForm] = useState<InsurerInput>(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || !id) return
    fetchInsurers()
      .then(list => {
        const ins = list.find(x => x.id === id)
        if (!ins) { toast.error('Assureur introuvable'); navigate('/assurance/insurers'); return }
        setForm({
          name: ins.name,
          acronym: ins.acronym,
          approval_number: ins.approval_number,
          type: ins.type,
          status: ins.status,
          contact_last_name: ins.contact_last_name,
          contact_first_name: ins.contact_first_name,
          contact_role: ins.contact_role,
          phone_primary: ins.phone_primary,
          phone_secondary: ins.phone_secondary,
          whatsapp: ins.whatsapp,
          email: ins.email,
          website: ins.website,
        })
      })
      .catch(err => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set<K extends keyof InsurerInput>(key: K, value: InsurerInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('La raison sociale est obligatoire'); return }
    setSaving(true)
    try {
      if (isEdit && id) {
        await updateInsurer(id, form)
        toast.success('Assureur mis à jour')
      } else {
        await createInsurer(form)
        toast.success('Assureur enregistré')
      }
      navigate('/assurance/insurers')
    } catch (err) {
      console.error(err)
      toast.error("Échec de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/assurance/insurers')}
          className="p-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F8FAF8] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#4A6B55]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">
            {isEdit ? "Modifier l'assureur" : 'Nouvel assureur'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Fiche compagnie d'assurance</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Informations générales */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#0B7439]" />
            <h2 className="font-semibold text-[#1A2E22]">Informations générales</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Field label="Raison sociale / Nom de la compagnie *">
                <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} required />
              </Field>
            </div>
            <Field label="Sigle">
              <input value={form.acronym ?? ''} onChange={e => set('acronym', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Numéro d'agrément">
              <input value={form.approval_number ?? ''} onChange={e => set('approval_number', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Type d'assureur">
              <select value={form.type} onChange={e => set('type', e.target.value as InsurerType)} className={inputCls}>
                {(Object.keys(INSURER_TYPE_LABELS) as InsurerType[]).map(t => (
                  <option key={t} value={t}>{INSURER_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
            <Field label="Statut">
              <select value={form.status} onChange={e => set('status', e.target.value as InsurerStatus)} className={inputCls}>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Contact principal */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserRound className="w-5 h-5 text-[#0B7439]" />
            <h2 className="font-semibold text-[#1A2E22]">Contact principal</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nom">
              <input value={form.contact_last_name ?? ''} onChange={e => set('contact_last_name', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Prénom">
              <input value={form.contact_first_name ?? ''} onChange={e => set('contact_first_name', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Fonction">
              <input value={form.contact_role ?? ''} onChange={e => set('contact_role', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Téléphone principal">
              <input type="tel" value={form.phone_primary ?? ''} onChange={e => set('phone_primary', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Téléphone secondaire">
              <input type="tel" value={form.phone_secondary ?? ''} onChange={e => set('phone_secondary', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="WhatsApp">
              <input type="tel" value={form.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Email professionnel">
              <input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Site web">
              <input value={form.website ?? ''} onChange={e => set('website', e.target.value || null)} placeholder="https://..." className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/assurance/insurers')}
            className="px-5 py-2.5 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}
