import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Save, Search, Building2, Upload, FileText, X, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchBuses, fetchCompanies, fetchInsurances, fetchInsurers,
  createInsurance, updateInsurance, uploadInsuranceDocument,
  type InsuranceBus, type InsuranceCompany,
} from '@/services/insurance.service'
import type { InsuranceInput, InsuranceStatus, Insurer } from '@/types/insurance.types'

const PERIODE_OPTIONS = ['Mensuel', '6 mois', 'Annuel']
const PERIODE_MONTHS: Record<string, number> = { Mensuel: 1, '6 mois': 6, Annuel: 12 }

function computeExpiry(effectDate: string, periode: string | null): string {
  const months = periode ? PERIODE_MONTHS[periode] : undefined
  if (!effectDate || !months) return ''
  const d = new Date(effectDate + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0)
  return d.toISOString().slice(0, 10)
}

const STATUS_OPTIONS: { value: InsuranceStatus; label: string }[] = [
  { value: 'actif', label: 'Actif' },
  { value: 'proche_echeance', label: 'Proche échéance' },
  { value: 'expire', label: 'Expiré' },
  { value: 'renouvele', label: 'Renouvelé' },
  { value: 'inactif', label: 'Inactif' },
]

const EMPTY: InsuranceInput = {
  bus_id: null,
  company_id: null,
  vehicle_type: null,
  registration_number: null,
  assureur: '',
  policy_number: null,
  effect_date: '',
  expiry_date: '',
  periode: null,
  amount: 0,
  edition_month: null,
  observation: null,
  document_url: null,
  status: 'actif',
}

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

export default function InsuranceForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const [buses, setBuses] = useState<InsuranceBus[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [insurers, setInsurers] = useState<Insurer[]>([])
  const [form, setForm] = useState<InsuranceInput>(EMPTY)
  const [busQuery, setBusQuery] = useState('')
  const [busOpen, setBusOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const busBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const [bs, cs, ins] = await Promise.all([fetchBuses(), fetchCompanies(), fetchInsurers()])
        setBuses(bs)
        setCompanies(cs)
        setInsurers(ins)

        if (isEdit && id) {
          const all = await fetchInsurances()
          const ins = all.find(i => i.id === id)
          if (!ins) { toast.error('Assurance introuvable'); navigate('/assurance/insurances'); return }
          setForm({
            bus_id: ins.bus_id,
            company_id: ins.company_id,
            vehicle_type: ins.vehicle_type,
            registration_number: ins.registration_number,
            assureur: ins.assureur,
            policy_number: ins.policy_number,
            effect_date: ins.effect_date,
            expiry_date: ins.expiry_date,
            periode: ins.periode,
            amount: Number(ins.amount ?? 0),
            edition_month: ins.edition_month,
            observation: ins.observation,
            document_url: ins.document_url,
            status: ins.status,
          })
          if (ins.bus_id) {
            const b = bs.find(x => x.id === ins.bus_id)
            if (b) setBusQuery(b.registration_number)
          }
        } else {
          const presetBus = searchParams.get('bus')
          if (presetBus) {
            const b = bs.find(x => x.id === presetBus)
            if (b) applyBus(b, cs)
          }
        }
      } catch (err) {
        console.error(err)
        toast.error('Erreur lors du chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (busBoxRef.current && !busBoxRef.current.contains(e.target as Node)) setBusOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function applyBus(b: InsuranceBus, comps = companies) {
    const company = comps.find(c => c.id === b.company_id)
    setForm(f => ({
      ...f,
      bus_id: b.id,
      registration_number: b.registration_number,
      vehicle_type: b.class || [b.brand, b.model].filter(Boolean).join(' ') || f.vehicle_type,
      company_id: b.company_id,
    }))
    setBusQuery(b.registration_number)
    setBusOpen(false)
    if (company) toast.success(`Société : ${company.name}`)
  }

  const filteredBuses = useMemo(() => {
    const q = busQuery.trim().toLowerCase()
    if (!q) return buses.slice(0, 8)
    return buses
      .filter(b =>
        b.registration_number.toLowerCase().includes(q) ||
        [b.brand, b.model].filter(Boolean).join(' ').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [busQuery, buses])

  const selectedCompany = companies.find(c => c.id === form.company_id)
  const activeInsurers = insurers.filter(i => i.status === 'actif')

  function set<K extends keyof InsuranceInput>(key: K, value: InsuranceInput[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setEffectDate(effect_date: string) {
    setForm(f => ({
      ...f,
      effect_date,
      edition_month: effect_date ? effect_date.slice(0, 7) : f.edition_month,
      expiry_date: computeExpiry(effect_date, f.periode) || f.expiry_date,
    }))
  }

  function setPeriode(periode: string | null) {
    setForm(f => ({
      ...f,
      periode,
      expiry_date: computeExpiry(f.effect_date, periode) || f.expiry_date,
    }))
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const okTypes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!okTypes.includes(file.type)) { toast.error('Formats acceptés : JPG, PNG, PDF'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop volumineux (max 10 Mo)'); return }
    setUploading(true)
    try {
      const url = await uploadInsuranceDocument(file)
      set('document_url', url)
      toast.success('Document téléchargé')
    } catch (err) {
      console.error(err)
      toast.error("Échec du téléchargement")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.assureur.trim()) { toast.error("L'assureur est obligatoire"); return }
    if (!form.effect_date || !form.expiry_date) { toast.error('Dates d\'effet et d\'échéance requises'); return }
    if (new Date(form.expiry_date) < new Date(form.effect_date)) {
      toast.error("La date d'échéance doit être après la date d'effet"); return
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await updateInsurance(id, form)
        toast.success('Assurance mise à jour')
      } else {
        await createInsurance(form)
        toast.success('Assurance enregistrée')
      }
      navigate('/assurance/insurances')
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
          onClick={() => navigate('/assurance/insurances')}
          className="p-2 rounded-xl border border-[#E2EAE5] bg-white hover:bg-[#F8FAF8] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[#4A6B55]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">
            {isEdit ? "Modifier l'assurance" : 'Nouvelle assurance'}
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Fiche assurance véhicule</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Véhicule & société */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
          <h2 className="font-semibold text-[#1A2E22]">Véhicule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div ref={busBoxRef} className="relative">
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Immatriculation *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  value={busQuery}
                  onChange={e => { setBusQuery(e.target.value); setBusOpen(true) }}
                  onFocus={() => setBusOpen(true)}
                  placeholder="Rechercher un véhicule..."
                  className={inputCls + ' pl-9'}
                />
              </div>
              {busOpen && filteredBuses.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white rounded-xl border border-[#E2EAE5] shadow-lg max-h-64 overflow-y-auto">
                  {filteredBuses.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => applyBus(b)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-[#F8FAF8] text-left transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-bold text-[#0B7439]">{b.registration_number}</p>
                        <p className="text-xs text-[#8AA898] truncate">
                          {[b.brand, b.model].filter(Boolean).join(' ') || '—'}
                        </p>
                      </div>
                      {b.class && <span className="text-xs text-[#6B7280] flex-shrink-0">{b.class}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Type d'auto</label>
              <input
                value={form.vehicle_type ?? ''}
                onChange={e => set('vehicle_type', e.target.value || null)}
                placeholder="Berline, Bus, Minibus..."
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Société</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E2EAE5] bg-[#F8FAF8]">
              <Building2 className="w-4 h-4 text-[#0B7439] flex-shrink-0" />
              <span className="text-sm text-[#1A2E22] font-medium">
                {selectedCompany ? selectedCompany.name : 'Sélectionnez un véhicule pour afficher la société'}
              </span>
            </div>
          </div>
        </div>

        {/* Détails assurance */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-4">
          <h2 className="font-semibold text-[#1A2E22]">Détails de l'assurance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Assureur *</label>
              <select
                value={form.assureur}
                onChange={e => set('assureur', e.target.value)}
                className={inputCls}
                required
              >
                <option value="" disabled>Sélectionnez un assureur</option>
                {activeInsurers.map(i => (
                  <option key={i.id} value={i.name}>
                    {i.name}{i.acronym ? ` (${i.acronym})` : ''}
                  </option>
                ))}
                {form.assureur && !activeInsurers.some(i => i.name === form.assureur) && (
                  <option value={form.assureur}>{form.assureur}</option>
                )}
              </select>
              {insurers.length === 0 && (
                <p className="text-xs text-[#B45309] mt-1.5">
                  Aucun assureur enregistré. Ajoutez-en un dans le menu Assureurs.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Numéro de police</label>
              <input
                value={form.policy_number ?? ''}
                onChange={e => set('policy_number', e.target.value || null)}
                placeholder="N° de police"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Période</label>
              <select
                value={form.periode ?? ''}
                onChange={e => setPeriode(e.target.value || null)}
                className={inputCls}
              >
                <option value="">Sélectionnez une période</option>
                {PERIODE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                {form.periode && !PERIODE_OPTIONS.includes(form.periode) && (
                  <option value={form.periode}>{form.periode}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Date d'effet *</label>
              <input
                type="date"
                value={form.effect_date}
                onChange={e => setEffectDate(e.target.value)}
                className={inputCls}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Date d'échéance *</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={e => set('expiry_date', e.target.value)}
                className={inputCls}
                required
              />
              <p className="text-xs text-[#8AA898] mt-1.5">Calculée selon la période, modifiable.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Montant (FCFA)</label>
              <input
                type="number"
                min={0}
                step="any"
                value={form.amount || ''}
                onChange={e => set('amount', Number(e.target.value))}
                placeholder="0"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Mois d'édition</label>
              <input
                type="month"
                value={form.edition_month ?? ''}
                onChange={e => set('edition_month', e.target.value || null)}
                className={inputCls}
              />
              <p className="text-xs text-[#8AA898] mt-1.5">Renseigné automatiquement depuis la date d'effet.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Statut</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as InsuranceStatus)}
                className={inputCls}
              >
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Observation</label>
            <textarea
              value={form.observation ?? ''}
              onChange={e => set('observation', e.target.value || null)}
              rows={3}
              placeholder="Remarques..."
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>

        {/* Document */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6 space-y-3">
          <h2 className="font-semibold text-[#1A2E22]">Document d'assurance</h2>
          <p className="text-xs text-[#6B7280]">Formats acceptés : JPG, PNG, PDF (max 10 Mo)</p>
          {form.document_url ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#E2EAE5] bg-[#F8FAF8]">
              <a
                href={form.document_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-[#0B7439] font-medium hover:underline min-w-0"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">Voir le document</span>
              </a>
              <button
                type="button"
                onClick={() => set('document_url', null)}
                className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#9CDAB6] bg-[#F4FBF7] text-[#0B7439] text-sm font-medium hover:bg-[#E7F6EC] transition-colors disabled:opacity-60"
            >
              {uploading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Téléchargement...</>
                : <><Upload className="w-4 h-4" /> Télécharger l'assurance</>}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={onFile}
            className="hidden"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/assurance/insurances')}
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
