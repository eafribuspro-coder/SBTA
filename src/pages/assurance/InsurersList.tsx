import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Pencil, Trash2, Building2, Phone, Mail, Globe, MessageCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchInsurers, deleteInsurer, INSURER_TYPE_LABELS,
} from '@/services/insurance.service'
import type { Insurer, InsurerType, InsurerStatus } from '@/types/insurance.types'

const inputCls =
  'px-3 py-2 rounded-xl border border-[#E2EAE5] bg-white text-sm text-[#1A2E22] ' +
  'focus:outline-none focus:ring-2 focus:ring-[#0B7439]/30 focus:border-[#0B7439] transition'

export default function InsurersList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Insurer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | InsurerType>('all')
  const [status, setStatus] = useState<'all' | InsurerStatus>('all')
  const [deleteTarget, setDeleteTarget] = useState<Insurer | null>(null)

  async function load() {
    setLoading(true)
    try {
      setRows(await fetchInsurers())
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
      if (type !== 'all' && r.type !== type) return false
      if (status !== 'all' && r.status !== status) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.acronym ?? '').toLowerCase().includes(q) ||
        (r.approval_number ?? '').toLowerCase().includes(q) ||
        [r.contact_first_name, r.contact_last_name].filter(Boolean).join(' ').toLowerCase().includes(q)
      )
    })
  }, [rows, search, type, status])

  async function onDelete() {
    if (!deleteTarget) return
    try {
      await deleteInsurer(deleteTarget.id)
      toast.success('Assureur supprimé')
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
          <h1 className="text-2xl font-bold text-[#1A2E22]">Assureurs</h1>
          <p className="text-sm text-[#6B7280] mt-1">Compagnies d'assurance partenaires</p>
        </div>
        <button
          onClick={() => navigate('/assurance/insurers/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nouvel assureur
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, sigle, n° agrément, contact..."
            className={inputCls + ' w-full pl-9'}
          />
        </div>
        <select value={type} onChange={e => setType(e.target.value as 'all' | InsurerType)} className={inputCls}>
          <option value="all">Tous les types</option>
          {(Object.keys(INSURER_TYPE_LABELS) as InsurerType[]).map(t => (
            <option key={t} value={t}>{INSURER_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value as 'all' | InsurerStatus)} className={inputCls}>
          <option value="all">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] flex flex-col items-center justify-center py-16 text-[#6B7280]">
          <Building2 className="w-10 h-10 text-[#9CDAB6] mb-2" />
          <p className="text-sm">Aucun assureur enregistré.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(ins => (
            <div key={ins.id} className="bg-white rounded-2xl border border-[#E2EAE5] p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#E7F6EC] flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-[#0B7439]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1A2E22] truncate">{ins.name}</p>
                    <p className="text-xs text-[#8AA898] truncate">
                      {ins.acronym ? ins.acronym + ' · ' : ''}{INSURER_TYPE_LABELS[ins.type]}
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg flex-shrink-0"
                  style={ins.status === 'actif'
                    ? { backgroundColor: '#E7F6EC', color: '#0B7439' }
                    : { backgroundColor: '#F3F4F6', color: '#6B7280' }}
                >
                  {ins.status === 'actif' ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {ins.approval_number && (
                <p className="text-xs text-[#6B7280]">N° agrément : <span className="font-medium text-[#1A2E22]">{ins.approval_number}</span></p>
              )}

              {(ins.contact_first_name || ins.contact_last_name) && (
                <div className="text-sm text-[#4A6B55]">
                  <p className="font-medium text-[#1A2E22]">
                    {[ins.contact_first_name, ins.contact_last_name].filter(Boolean).join(' ')}
                  </p>
                  {ins.contact_role && <p className="text-xs text-[#8AA898]">{ins.contact_role}</p>}
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-xs text-[#4A6B55]">
                {ins.phone_primary && (
                  <span className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#0B7439]" />{ins.phone_primary}{ins.phone_secondary ? ` / ${ins.phone_secondary}` : ''}</span>
                )}
                {ins.whatsapp && (
                  <span className="flex items-center gap-2"><MessageCircle className="w-3.5 h-3.5 text-[#16A34A]" />{ins.whatsapp}</span>
                )}
                {ins.email && (
                  <a href={`mailto:${ins.email}`} className="flex items-center gap-2 hover:text-[#0B7439] hover:underline truncate"><Mail className="w-3.5 h-3.5 text-[#0B7439]" />{ins.email}</a>
                )}
                {ins.website && (
                  <a href={ins.website.startsWith('http') ? ins.website : `https://${ins.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-[#0B7439] hover:underline truncate"><Globe className="w-3.5 h-3.5 text-[#0B7439]" />{ins.website}</a>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 pt-2 border-t border-[#F0F4F1] mt-auto">
                <button
                  onClick={() => navigate(`/assurance/insurers/${ins.id}/edit`)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#E7F6EC] text-[#0B7439] text-sm font-medium transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Modifier
                </button>
                <button
                  onClick={() => setDeleteTarget(ins)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#B91C1C] text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-[#1A2E22] text-lg">Supprimer l'assureur ?</h3>
            <p className="text-sm text-[#6B7280] mt-2">
              <strong>{deleteTarget.name}</strong> sera supprimé définitivement.
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
