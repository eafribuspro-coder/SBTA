import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileText, Plus, CreditCard as Edit2, RefreshCw, Trash2, Search, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  fetchDocuments, fetchVehiclesForPicker, fetchServiceTypes, fetchProviders,
  deleteDocument, effectiveStatus, alertLevel, STATUS_LABELS,
} from '@/services/logistics.service'
import type {
  VehicleDocument, Vehicle, ServiceType, Provider,
} from '@/types/logistics.types'
import DocumentModal, { type DocModalMode } from './DocumentModal'

const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#E7F6EC', text: '#0B7439', dot: '#16A34A' },
  orange: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  red:    { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  blue:   { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  gray:   { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
}

export default function DocumentsList() {
  const [params, setParams] = useSearchParams()
  const [documents, setDocuments] = useState<VehicleDocument[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const [modal, setModal] = useState<{ mode: DocModalMode; doc: VehicleDocument | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<VehicleDocument | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([fetchDocuments(), fetchVehiclesForPicker(), fetchServiceTypes(), fetchProviders()])
      .then(([d, v, s, p]) => { setDocuments(d); setVehicles(v); setServiceTypes(s); setProviders(p) })
      .catch((err) => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  useEffect(() => {
    if (params.get('new') === '1') {
      setModal({ mode: 'create', doc: null })
      params.delete('new'); setParams(params, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => documents.filter(d => {
    if (scope === 'current' && !d.is_current) return false
    if (statusFilter !== 'all' && effectiveStatus(d) !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const reg = d.vehicle?.registration_number || d.vehicle?.provisional_number || ''
      if (![d.service_type_name, d.provider_name ?? '', reg].some(v => v.toLowerCase().includes(q))) return false
    }
    return true
  }), [documents, scope, statusFilter, search])

  const remove = async () => {
    if (!confirmDelete) return
    try { await deleteDocument(confirmDelete.id); toast.success('Document supprimé'); setConfirmDelete(null); load() }
    catch (err) { console.error(err); toast.error('Suppression impossible') }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#E7F6EC] flex items-center justify-center">
            <FileText className="w-6 h-6 text-[#0B7439]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1A2E22]">Documents véhicules</h1>
            <p className="text-sm text-[#6B7280]">Visites techniques, cartes, patentes...</p>
          </div>
        </div>
        <button onClick={() => setModal({ mode: 'create', doc: null })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors">
          <Plus className="w-4 h-4" /> Nouveau document
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-[#E2EAE5] text-sm text-[#4A6B55] focus:outline-none">
          <option value="all">Tous les statuts</option>
          <option value="valide">Valide</option>
          <option value="proche_echeance">Proche échéance</option>
          <option value="expire">Expiré</option>
          <option value="renouvele">Renouvelé</option>
        </select>
        <select value={scope} onChange={e => setScope(e.target.value as 'current' | 'all')} className="px-3 py-2 rounded-xl border border-[#E2EAE5] text-sm text-[#4A6B55] focus:outline-none">
          <option value="current">En cours</option>
          <option value="all">Tout l'historique</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#6B7280]">Aucun document.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] text-[#4A6B55] text-left">
                  <th className="px-4 py-3 font-semibold">Véhicule</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Prestataire</th>
                  <th className="px-4 py-3 font-semibold">Échéance</th>
                  <th className="px-4 py-3 font-semibold text-right">Montant</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F1]">
                {filtered.map(d => {
                  const st = effectiveStatus(d)
                  const c = STATUS_STYLE[alertLevel(d)]
                  const reg = d.vehicle?.registration_number || d.vehicle?.provisional_number || '—'
                  return (
                    <tr key={d.id} className="hover:bg-[#F8FAF8]">
                      <td className="px-4 py-3 font-mono font-semibold text-[#0B7439]">{reg}</td>
                      <td className="px-4 py-3 text-[#1A2E22]">{d.service_type_name}{d.year_concerned ? ` ${d.year_concerned}` : ''}</td>
                      <td className="px-4 py-3 text-[#4A6B55]">{d.provider_name || '—'}</td>
                      <td className="px-4 py-3 text-[#4A6B55]">{d.expiry_date ? new Date(d.expiry_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3 text-right text-[#4A6B55]">{formatCurrency(d.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                          {STATUS_LABELS[st]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {d.document_url && <a href={d.document_url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-[#F3F4F6] text-[#4A6B55]"><ExternalLink className="w-4 h-4" /></a>}
                          {d.is_current && <button onClick={() => setModal({ mode: 'renew', doc: d })} className="p-2 rounded-lg hover:bg-[#DBEAFE] text-[#1D4ED8]" title="Renouveler"><RefreshCw className="w-4 h-4" /></button>}
                          <button onClick={() => setModal({ mode: 'edit', doc: d })} className="p-2 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439]"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setConfirmDelete(d)} className="p-2 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C]"><Trash2 className="w-4 h-4" /></button>
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

      {modal && (
        <DocumentModal
          mode={modal.mode}
          vehicles={vehicles}
          serviceTypes={serviceTypes}
          providers={providers}
          existing={modal.doc}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
            <h2 className="font-semibold text-[#1A2E22] mb-2">Supprimer le document</h2>
            <p className="text-sm text-[#6B7280] mb-5">Cette action est définitive. Continuer ?</p>
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
