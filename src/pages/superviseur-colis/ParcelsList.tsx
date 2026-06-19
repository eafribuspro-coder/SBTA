import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Search, RefreshCw, Eye, Printer, Filter, X,
  ArrowUpDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { fetchAllParcels, fetchParcelAgentInfo } from '@/services/parcel.service'
import { buildReceiptData, printParcelTicket } from '@/utils/printParcelTicket'
import type { Parcel, ParcelStatus } from '@/types/parcel.types'

const STATUS_CONFIG: Record<ParcelStatus, { label: string; color: string; bg: string }> = {
  enregistre:    { label: 'Enregistré',    color: '#0B7439', bg: '#d4edda' },
  mis_en_paquet: { label: 'Mis en paquet', color: '#1D6FA4', bg: '#DBEAFE' },
  expedie:       { label: 'Expédié',       color: '#D97706', bg: '#FEF3C7' },
  arrive:        { label: 'Arrivé',        color: '#1D6FA4', bg: '#DBEAFE' },
  livre:         { label: 'Retiré',        color: '#0B7439', bg: '#d4edda' },
  retourne:      { label: 'Retourné',      color: '#92400E', bg: '#FEF3C7' },
  perdu:         { label: 'Perdu',         color: '#AF3029', bg: '#f8d7d5' },
}

const PAGE_SIZE = 20

type SortField = 'registered_at' | 'parcel_code' | 'total_amount' | 'status'
type SortDir   = 'asc' | 'desc'

export default function SuperviseurParcelsList() {
  const navigate = useNavigate()
  const [parcels, setParcels]     = useState<Parcel[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<ParcelStatus | ''>('')
  const [page, setPage]           = useState(1)
  const [sortField, setSortField] = useState<SortField>('registered_at')
  const [sortDir, setSortDir]     = useState<SortDir>('desc')
  const today = format(new Date(), 'dd/MM/yyyy', { locale: fr })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await fetchAllParcels()
      setParcels(all)
    } catch {
      toast.error('Erreur chargement courriers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filter
  const filtered = parcels.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q
      || p.parcel_code.toLowerCase().includes(q)
      || p.reference.toLowerCase().includes(q)
      || p.sender_name.toLowerCase().includes(q)
      || p.recipient_name.toLowerCase().includes(q)
      || p.recipient_city.toLowerCase().includes(q)
      || p.origin_station_name?.toLowerCase().includes(q)
      || p.destination_station_name?.toLowerCase().includes(q)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let va: string | number = 0, vb: string | number = 0
    if (sortField === 'registered_at') { va = a.registered_at; vb = b.registered_at }
    else if (sortField === 'parcel_code') { va = a.parcel_code; vb = b.parcel_code }
    else if (sortField === 'total_amount') { va = Number(a.total_amount); vb = Number(b.total_amount) }
    else if (sortField === 'status') { va = a.status; vb = b.status }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  function handleSearch(v: string) { setSearch(v); setPage(1) }
  function handleStatusFilter(v: ParcelStatus | '') { setStatusFilter(v); setPage(1) }

  async function handlePrint(parcel: Parcel) {
    const agentInfo = await fetchParcelAgentInfo(parcel.origin_station_id, parcel.destination_station_id).catch(() => null)
    await printParcelTicket(buildReceiptData(parcel, parcel.origin_station_name, '', null, null, agentInfo))
  }

  const SortIcon = ({ field }: { field: SortField }) => (
    <ArrowUpDown
      className="w-3 h-3 inline-block ml-1 opacity-50"
      style={{ opacity: sortField === field ? 1 : 0.4, color: sortField === field ? '#0B7439' : 'inherit' }}
    />
  )

  const statusCounts: Partial<Record<ParcelStatus, number>> = {}
  for (const p of parcels) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-5" style={{ backgroundColor: 'var(--bg-subtle)', minHeight: '100vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Tous les courriers</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {parcels.length} courrier{parcels.length > 1 ? 's' : ''} au total — {today}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border flex-shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          title="Actualiser"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status chips summary */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleStatusFilter('')}
          className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
          style={{
            backgroundColor: !statusFilter ? '#0B7439' : 'var(--surface)',
            color: !statusFilter ? '#fff' : 'var(--text-secondary)',
            border: '1px solid',
            borderColor: !statusFilter ? '#0B7439' : 'var(--border)',
          }}
        >
          Tous ({parcels.length})
        </button>
        {(Object.entries(STATUS_CONFIG) as [ParcelStatus, typeof STATUS_CONFIG[ParcelStatus]][]).map(([key, cfg]) =>
          (statusCounts[key] ?? 0) > 0 ? (
            <button
              key={key}
              onClick={() => handleStatusFilter(statusFilter === key ? '' : key)}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor: statusFilter === key ? cfg.color : cfg.bg,
                color: statusFilter === key ? '#fff' : cfg.color,
                border: '1px solid',
                borderColor: cfg.color + '40',
              }}
            >
              {cfg.label} ({statusCounts[key]})
            </button>
          ) : null
        )}
      </div>

      {/* Search + filters bar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Rechercher par code, expéditeur, destinataire, ville, gare…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg text-sm border"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {search && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <Filter className="w-3.5 h-3.5" />
          <select
            value={statusFilter}
            onChange={e => handleStatusFilter(e.target.value as ParcelStatus | '')}
            className="bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="">Tous les statuts</option>
            {(Object.entries(STATUS_CONFIG) as [ParcelStatus, typeof STATUS_CONFIG[ParcelStatus]][]).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count */}
      {(search || statusFilter) && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''} trouvé{filtered.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
          </div>
        ) : paginated.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun courrier trouvé</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="lg:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {paginated.map(parcel => {
                const sc = STATUS_CONFIG[parcel.status]
                return (
                  <div key={parcel.id} className="p-3 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm" style={{ color: '#0B7439' }}>
                        {parcel.parcel_code}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span><span style={{ color: 'var(--text-muted)' }}>De : </span>{parcel.sender_name}</span>
                      <span><span style={{ color: 'var(--text-muted)' }}>À : </span>{parcel.recipient_name}</span>
                      <span><span style={{ color: 'var(--text-muted)' }}>Gare départ : </span>{parcel.origin_station_name}</span>
                      <span><span style={{ color: 'var(--text-muted)' }}>Gare dest. : </span>{parcel.destination_station_name}</span>
                      <span><span style={{ color: 'var(--text-muted)' }}>Montant : </span><strong style={{ color: '#0B7439' }}>{Number(parcel.total_amount ?? 0).toLocaleString('fr-CI')} F</strong></span>
                      <span><span style={{ color: 'var(--text-muted)' }}>Date : </span>{format(new Date(parcel.registered_at), 'dd/MM/yyyy', { locale: fr })}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => navigate(`/superviseur-colis/parcels/${parcel.id}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-1 justify-center"
                        style={{ backgroundColor: '#0B7439', color: '#fff' }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Voir détails
                      </button>
                      <button
                        onClick={() => handlePrint(parcel)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort('parcel_code')} className="flex items-center gap-1 font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                        Code <SortIcon field="parcel_code" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Expéditeur</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Destinataire</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Gare départ</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Gare destination</th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort('total_amount')} className="flex items-center gap-1 font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                        Montant <SortIcon field="total_amount" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort('status')} className="flex items-center gap-1 font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                        Statut <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button onClick={() => toggleSort('registered_at')} className="flex items-center gap-1 font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>
                        Date <SortIcon field="registered_at" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {paginated.map(parcel => {
                    const sc = STATUS_CONFIG[parcel.status]
                    return (
                      <tr key={parcel.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-sm" style={{ color: '#0B7439' }}>
                          {parcel.parcel_code}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          <p className="font-medium text-sm">{parcel.sender_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{parcel.sender_phone}</p>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                          <p className="font-medium text-sm">{parcel.recipient_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{parcel.recipient_city}</p>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {parcel.origin_station_name}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {parcel.destination_station_name}
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm" style={{ color: '#0B7439' }}>
                          {Number(parcel.total_amount ?? 0).toLocaleString('fr-CI')} F
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                          {format(new Date(parcel.registered_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => navigate(`/superviseur-colis/parcels/${parcel.id}`)}
                              className="p-1.5 rounded hover:bg-gray-100"
                              title="Voir détail"
                            >
                              <Eye className="w-4 h-4" style={{ color: '#0B7439' }} />
                            </button>
                            <button
                              onClick={() => handlePrint(parcel)}
                              className="p-1.5 rounded hover:bg-gray-100"
                              title="Imprimer ticket"
                            >
                              <Printer className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Page {page} / {totalPages} — {filtered.length} résultats
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded disabled:opacity-40"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                    const n = start + i
                    return (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className="w-7 h-7 rounded text-xs font-medium"
                        style={{
                          backgroundColor: page === n ? '#0B7439' : 'var(--surface)',
                          color: page === n ? '#fff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded disabled:opacity-40"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
