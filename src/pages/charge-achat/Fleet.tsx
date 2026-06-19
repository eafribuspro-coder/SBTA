import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Car, Search, ChevronDown, ChevronRight, ChevronUp, Layers } from 'lucide-react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import type { VehicleExpense } from '@/types/chargeAchat.types'
import { buildCompanyGroups } from '@/utils/companyGroups'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

interface VehicleRow {
  registration_number: string
  company_id: string
  company_code: string
  company_name: string
  total_week: number
  total_all: number
  incident_count: number
  last_intervention: string | null
  week_expenses: VehicleExpense[]
  all_expenses: VehicleExpense[]
}

interface Company { id: string; name: string; code: string; parent_id?: string | null; is_group?: boolean }

function statusColor(totalWeek: number) {
  if (totalWeek === 0) return { dot: '#10B981', label: 'Aucune dépense', bg: '#D1FAE5', text: '#065F46' }
  if (totalWeek >= 50000) return { dot: '#DC2626', label: 'Dépense importante', bg: '#fee2e2', text: '#991B1B' }
  return { dot: '#F59E0B', label: 'Dépense mineure', bg: '#FEF3C7', text: '#92400E' }
}

export default function Fleet() {
  const navigate = useNavigate()
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(now,   { weekStartsOn: 1 }), 'yyyy-MM-dd')

  const [vehicles,      setVehicles]      = useState<VehicleRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [expanded,      setExpanded]      = useState<string | null>(null)
  const [companies,     setCompanies]     = useState<Company[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: fleetData }, { data: allExpenses }, { data: companiesData }] = await Promise.all([
        supabase.from('fleet_vehicles').select('registration_number, company_id, company:companies(name,code)').eq('is_active', true),
        supabase.from('vehicle_expenses').select('*, company:companies(name,code), category:expense_categories(name,icon,color)').eq('source', 'charge_achat').order('expense_date', { ascending: false }),
        supabase.from('companies').select('id,name,code,parent_id,is_group').order('name'),
      ])

      if (companiesData) setCompanies(companiesData)

      const expensesAll = (allExpenses ?? []) as VehicleExpense[]

      const rows: Record<string, VehicleRow> = {}

      // Seed from fleet
      for (const v of fleetData ?? []) {
        const key = `${v.registration_number}__${v.company_id}`
        if (!rows[key]) {
          rows[key] = {
            registration_number: v.registration_number,
            company_id:     v.company_id,
            company_code:   (v as any).company?.code ?? '',
            company_name:   (v as any).company?.name ?? '',
            total_week:     0,
            total_all:      0,
            incident_count: 0,
            last_intervention: null,
            week_expenses:  [],
            all_expenses:   [],
          }
        }
      }

      // Aggregate expenses
      for (const e of expensesAll) {
        const key = `${e.registration_number}__${e.company_id}`
        if (!rows[key]) {
          rows[key] = {
            registration_number: e.registration_number,
            company_id:     e.company_id,
            company_code:   (e as any).company?.code ?? '',
            company_name:   (e as any).company?.name ?? '',
            total_week: 0, total_all: 0, incident_count: 0, last_intervention: null,
            week_expenses: [], all_expenses: [],
          }
        }
        const r = rows[key]
        r.total_all += Number(e.amount)
        r.all_expenses.push(e)
        if (e.expense_date >= weekStart && e.expense_date <= weekEnd) {
          r.total_week += Number(e.amount)
          r.week_expenses.push(e)
        }
        r.incident_count++
        if (!r.last_intervention || e.expense_date > r.last_intervention) {
          r.last_intervention = e.expense_date
        }
      }

      setVehicles(Object.values(rows).sort((a, b) => b.total_week - a.total_week))
    } finally {
      setLoading(false)
    }
  }, [weekStart, weekEnd])

  useEffect(() => { load() }, [load])

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.registration_number.toLowerCase().includes(search.toLowerCase())
    const matchCompany = !companyFilter || v.company_id === companyFilter
    return matchSearch && matchCompany
  })

  // Build hierarchy-aware grouping
  const { groups: companyGroups, standalone: standaloneCompanies } = buildCompanyGroups(companies)

  // Map company_id → parent group id (for display grouping)
  const subsidiaryToGroup: Record<string, string> = {}
  for (const { group, subsidiaries } of companyGroups) {
    for (const s of subsidiaries) subsidiaryToGroup[s.id] = group.id
  }

  // Group vehicles: group subsidiaries under their parent group key
  const grouped: Record<string, VehicleRow[]> = {}
  for (const v of filtered) {
    const groupId = subsidiaryToGroup[v.company_id]
    const key = groupId
      ? (companies.find(c => c.id === groupId)?.code ?? v.company_code)
      : (v.company_code || 'DIVERS')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(v)
  }

  // Determine display label for each group key
  const groupLabel = (key: string): { name: string; isGroup: boolean; subsidiaryNames: string[] } => {
    const grp = companyGroups.find(g => g.group.code === key)
    if (grp) return {
      name: grp.group.name,
      isGroup: true,
      subsidiaryNames: [...new Set(filtered.filter(v => subsidiaryToGroup[v.company_id] === grp.group.id).map(v => v.company_code))].sort(),
    }
    return { name: key, isGroup: false, subsidiaryNames: [] }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Parc de véhicules</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Semaine du {format(startOfWeek(now, { weekStartsOn: 1 }), 'dd/MM', { locale: fr })} au {format(endOfWeek(now, { weekStartsOn: 1 }), 'dd/MM/yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          {[
            { dot: '#10B981', label: 'Aucune dépense' },
            { dot: '#F59E0B', label: '< 50 000 XOF' },
            { dot: '#DC2626', label: '≥ 50 000 XOF' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.dot }} />
              <span className="hidden sm:inline">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher immatriculation…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="relative">
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <option value="">Toutes les sociétés</option>
            {(() => {
              const { groups, standalone } = buildCompanyGroups(companies)
              return (
                <>
                  {groups.map(({ group, subsidiaries }) => (
                    <optgroup key={group.id} label={`▸ ${group.code}`}>
                      {subsidiaries.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                    </optgroup>
                  ))}
                  {standalone.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </>
              )
            })()}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([code, rows]) => {
            const lbl = groupLabel(code)
            return (
            <div key={code} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {/* Company header */}
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#0B7439' }}>
                <div className="flex items-center gap-2 flex-wrap">
                  {lbl.isGroup && <Layers className="w-4 h-4 text-green-200 flex-shrink-0" />}
                  <span className="text-sm font-bold text-white">{lbl.name}</span>
                  {lbl.isGroup && lbl.subsidiaryNames.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {lbl.subsidiaryNames.map(n => (
                        <span key={n} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#d1fae5' }}>{n}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-green-100">{rows.length} véhicule{rows.length > 1 ? 's' : ''}</span>
                  <span className="text-sm font-bold text-white">{fmt(rows.reduce((a, b) => a + b.total_week, 0))}</span>
                </div>
              </div>

              {/* Vehicle rows */}
              <div className="divide-y" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                {rows.map(v => {
                  const st = statusColor(v.total_week)
                  const isOpen = expanded === v.registration_number + v.company_id
                  return (
                    <div key={v.registration_number + v.company_id}>
                      <button
                        onClick={() => setExpanded(isOpen ? null : v.registration_number + v.company_id)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.dot }} />
                        <Car className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <span className="font-mono font-bold text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                          {v.registration_number}
                        </span>
                        <div className="hidden sm:flex items-center gap-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <span>{v.incident_count} intervention{v.incident_count > 1 ? 's' : ''}</span>
                          {v.last_intervention && (
                            <span>Dernière : {format(new Date(v.last_intervention), 'dd/MM/yy', { locale: fr })}</span>
                          )}
                          <span style={{ color: 'var(--text-secondary)' }}>Total : {fmt(v.total_all)}</span>
                        </div>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-bold ml-2 flex-shrink-0"
                          style={{ backgroundColor: st.bg, color: st.text }}
                        >
                          {v.total_week > 0 ? fmt(v.total_week) : 'Aucune'}
                        </span>
                        {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-3" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                          <p className="text-xs font-semibold mb-2 pt-2" style={{ color: 'var(--text-muted)' }}>
                            Historique complet — {v.all_expenses.length} entrée{v.all_expenses.length > 1 ? 's' : ''}
                          </p>
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {v.all_expenses.map(e => (
                              <div key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                                <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                  {format(new Date(e.expense_date), 'dd/MM/yy', { locale: fr })}
                                </span>
                                <span className="text-lg flex-shrink-0">{(e as any).category?.icon ?? '📦'}</span>
                                <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{e.description}</span>
                                {e.supplier && <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{e.supplier}</span>}
                                <span className="text-xs font-bold flex-shrink-0" style={{ color: Number(e.amount) >= 200000 ? '#DC2626' : '#0B7439' }}>
                                  {fmt(Number(e.amount))}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => navigate(`/charge-achat/expenses?vehicle=${v.registration_number}`)}
                            className="mt-2 text-xs flex items-center gap-1"
                            style={{ color: '#0B7439' }}
                          >
                            Voir toutes les dépenses <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
