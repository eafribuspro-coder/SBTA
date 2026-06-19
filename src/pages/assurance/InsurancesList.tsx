import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Pencil, Trash2, RefreshCw, X, Loader2, ShieldCheck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  fetchInsurances, deleteInsurance, renewInsurance,
  effectiveStatus, STATUS_LABELS,
  type InsuranceCompany, fetchCompanies,
} from '@/services/insurance.service'
import type { VehicleInsurance, InsuranceStatus, InsuranceInput } from '@/types/insurance.types'

const STATUS_STYLE: Record<InsuranceStatus, { bg: string; text: string; dot: string; blink: boolean }> = {
  actif:           { bg: '#E7F6EC', text: '#0B7439', dot: '#16A34A', blink: false },
  proche_echeance: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B', blink: true },
  expire:          { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626', blink: true },
  renouvele:       { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB', blink: false },
  inactif:         { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF', blink: false },
}

type StatusFilter = 'all' | InsuranceStatus
type ScopeFilter = 'current' | 'history'

const inputCls =
  'px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

const RENEW_PERIODE_OPTIONS = ['Mensuel', '6 mois', 'Annuel']
const RENEW_PERIODE_MONTHS: Record<string, number> = { Mensuel: 1, '6 mois': 6, Annuel: 12 }

function computeExpiry(effectDate: string, periode: string): string {
  const months = RENEW_PERIODE_MONTHS[periode]
  if (!effectDate || !months) return ''
  const d = new Date(effectDate + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  const day = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() !== day) d.setDate(0)
  return d.toISOString().slice(0, 10)
}

export default function InsurancesList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<VehicleInsurance[]>([])
  const [companies, setCompanies] = useState<InsuranceCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [companyId, setCompanyId] = useState<string>('all')
  const [scope, setScope] = useState<ScopeFilter>('current')

  const [renewTarget, setRenewTarget] = useState<VehicleInsurance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VehicleInsurance | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [ins, cs] = await Promise.all([fetchInsurances(), fetchCompanies()])
      setRows(ins)
      setCompanies(cs)
    } catch (err) {
      console.error(err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (scope === 'current' && !r.is_current) return false
      if (scope === 'history' && r.is_current) return false
      if (status !== 'all' && effectiveStatus(r) !== status) return false
      if (companyId !== 'all' && r.company_id !== companyId) return false
      if (!q) return true
      return (
        (r.registration_number ?? '').toLowerCase().includes(q) ||
        r.assureur.toLowerCase().includes(q) ||
        (r.policy_number ?? '').toLowerCase().includes(q) ||
        (r.company_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, status, companyId, scope])

  async function onDelete() {
    if (!deleteTarget) return
    try {
      await deleteInsurance(deleteTarget.id)
      toast.success('Assurance supprimée')
      setDeleteTarget(null)
      load()
    } catch (err) {
      console.error(err)
      toast.error('Échec de la suppression')
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Assurances</h1>
          <p className="text-sm text-[#6B7280] mt-1">Liste des assurances de la flotte</p>
        </div>
        <button
          onClick={() => navigate('/assurance/insurances/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouvelle assurance
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Immatriculation, assureur, police, société..."
            className={inputCls + ' w-full pl-9'}
          />
        </div>
        <select value={scope} onChange={e => setScope(e.target.value as ScopeFilter)} className={inputCls}>
          <option value="current">En cours</option>
          <option value="history">Historique</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as StatusFilter)} className={inputCls}>
          <option value="all">Tous les statuts</option>
          {(Object.keys(STATUS_LABELS) as InsuranceStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select value={companyId} onChange={e => setCompanyId(e.target.value)} className={inputCls}>
          <option value="all">Toutes les sociétés</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#6B7280]">
            <ShieldCheck className="w-10 h-10 text-[#9CDAB6] mb-2" />
            <p className="text-sm">Aucune assurance trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                  <th className="px-4 py-3">Immatriculation</th>
                  <th className="px-4 py-3">Société</th>
                  <th className="px-4 py-3">Assureur</th>
                  <th className="px-4 py-3">Effet</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {filtered.map(r => {
                  const st = effectiveStatus(r)
                  const s = STATUS_STYLE[st]
                  return (
                    <tr key={r.id} className="hover:bg-[#F8FAF8] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-[#0B7439]">{r.registration_number ?? '—'}</td>
                      <td className="px-4 py-3 text-[#4A6B55]">{r.company_name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#1A2E22]">{r.assureur}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{new Date(r.effect_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-[#6B7280]">{new Date(r.expiry_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#1A2E22]">{formatCurrency(Number(r.amount ?? 0))}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
                          style={{ backgroundColor: s.bg, color: s.text }}
                        >
                          <span
                            className={'w-2 h-2 rounded-full ' + (s.blink ? 'animate-pulse' : '')}
                            style={{ backgroundColor: s.dot }}
                          />
                          {STATUS_LABELS[st]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.is_current && (
                            <button
                              onClick={() => setRenewTarget(r)}
                              title="Renouveler"
                              className="p-2 rounded-lg hover:bg-[#DBEAFE] text-[#1D4ED8] transition-colors"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/assurance/insurances/${r.id}/edit`)}
                            title="Modifier"
                            className="p-2 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439] transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            title="Supprimer"
                            className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C] transition-colors"
                          >
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
        )}
      </div>

      {renewTarget && (
        <RenewModal
          insurance={renewTarget}
          onClose={() => setRenewTarget(null)}
          onDone={() => { setRenewTarget(null); load() }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1A2E22] text-lg">Supprimer l'assurance ?</h3>
            <p className="text-sm text-[#6B7280] mt-2">
              Cette action est irréversible. L'assurance de <strong>{deleteTarget.registration_number ?? 'ce véhicule'}</strong> sera supprimée.
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8]">Annuler</button>
              <button onClick={onDelete} className="px-4 py-2 rounded-xl bg-[#DC2626] text-white text-sm font-medium hover:bg-[#B91C1C]">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RenewModal({ insurance, onClose, onDone }: {
  insurance: VehicleInsurance
  onClose: () => void
  onDone: () => void
}) {
  const [effect, setEffect] = useState('')
  const [expiry, setExpiry] = useState('')
  const [amount, setAmount] = useState<number>(Number(insurance.amount ?? 0))
  const [periode, setPeriode] = useState(insurance.periode ?? '')
  const [policy, setPolicy] = useState(insurance.policy_number ?? '')
  const [saving, setSaving] = useState(false)

  const mInput =
    'w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
    'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

  function onEffectChange(value: string) {
    setEffect(value)
    const next = computeExpiry(value, periode)
    if (next) setExpiry(next)
  }

  function onPeriodeChange(value: string) {
    setPeriode(value)
    const next = computeExpiry(effect, value)
    if (next) setExpiry(next)
  }

  async function submit() {
    if (!effect || !expiry) { toast.error('Dates requises'); return }
    if (new Date(expiry) < new Date(effect)) { toast.error("L'échéance doit suivre l'effet"); return }
    setSaving(true)
    try {
      const input: InsuranceInput = {
        bus_id: insurance.bus_id,
        company_id: insurance.company_id,
        vehicle_type: insurance.vehicle_type,
        registration_number: insurance.registration_number,
        assureur: insurance.assureur,
        policy_number: policy || null,
        effect_date: effect,
        expiry_date: expiry,
        periode: periode || null,
        amount,
        edition_month: insurance.edition_month,
        observation: insurance.observation,
        document_url: insurance.document_url,
        status: 'actif',
      }
      await renewInsurance(insurance.id, input)
      toast.success('Assurance renouvelée')
      onDone()
    } catch (err) {
      console.error(err)
      toast.error('Échec du renouvellement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2EAE5]">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#1D4ED8]" />
            <h3 className="font-semibold text-[#1A2E22]">Renouveler l'assurance</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="px-3 py-2 rounded-xl bg-[#F8FAF8] text-sm text-[#4A6B55]">
            <span className="font-mono font-bold text-[#0B7439]">{insurance.registration_number ?? '—'}</span>
            {' · '}{insurance.assureur}
            <span className="block text-xs text-[#8AA898] mt-0.5">
              L'ancienne période sera archivée dans l'historique.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Période</label>
              <select value={periode} onChange={e => onPeriodeChange(e.target.value)} className={mInput}>
                <option value="">Sélectionnez une période</option>
                {RENEW_PERIODE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                {periode && !RENEW_PERIODE_OPTIONS.includes(periode) && (
                  <option value={periode}>{periode}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Nouvelle date d'effet *</label>
              <input type="date" value={effect} onChange={e => onEffectChange(e.target.value)} className={mInput} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Nouvelle date d'échéance *</label>
              <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className={mInput} />
              <p className="text-xs text-[#8AA898] mt-1.5">Calculée selon la période, modifiable.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Nouveau montant (FCFA)</label>
              <input type="number" min={0} step="any" value={amount || ''} onChange={e => setAmount(Number(e.target.value))} className={mInput} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Numéro de police</label>
              <input value={policy} onChange={e => setPolicy(e.target.value)} placeholder="N° de police" className={mInput} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E2EAE5]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8]">Annuler</button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D4ED8] text-white text-sm font-medium hover:bg-[#1741b0] disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Renouveler
          </button>
        </div>
      </div>
    </div>
  )
}
