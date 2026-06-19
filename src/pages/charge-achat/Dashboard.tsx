import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Plus, TrendingUp, Car, BarChart2,
  RefreshCw, ChevronRight, Calendar, Zap,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, startOfDay, subDays, startOfYear, endOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import type { VehicleExpense, CompanySummary } from '@/types/chargeAchat.types'
import { buildCompanyGroups } from '@/utils/companyGroups'

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

const COMPANY_COLORS: Record<string, string> = {
  SBTA: '#0B7439', TST: '#1D6FA4', ETL: '#D97706',
  SNT: '#9CA3AF', 'G-OUMÉ': '#7C3AED', DIVERS: '#6B7280',
  'SBTA-BIS': '#059669', 'SBTA-BLO': '#0d9488', 'SBTA-BSA': '#0891b2',
  'SBTA-BAB': '#7c3aed', 'SBTA-BAZ': '#a855f7', 'SBTA-BNO': '#6366f1',
  'SBTA-BFA': '#8b5cf6', 'SBTA-BSO': '#c084fc', 'SBTA- BAR': '#a78bfa',
}

const PIE_COLORS = ['#0B7439', '#1D6FA4', '#D97706', '#DC2626', '#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#64748B']

type PeriodKey = 'daily' | 'weekly' | 'monthly' | 'semiannual' | 'annual' | 'custom'
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'daily', label: 'Journalier' },
  { key: 'weekly', label: 'Hebdomadaire' },
  { key: 'monthly', label: 'Mensuel' },
  { key: 'semiannual', label: 'Semestriel' },
  { key: 'annual', label: 'Annuel' },
  { key: 'custom', label: 'Personnalisé' },
]

function getPeriodRange(period: PeriodKey, customFrom: string, customTo: string) {
  const now = new Date()
  let start: Date, end: Date
  switch (period) {
    case 'daily':
      start = startOfDay(now)
      end = now
      break
    case 'weekly':
      start = startOfWeek(now, { weekStartsOn: 1 })
      end = endOfWeek(now, { weekStartsOn: 1 })
      break
    case 'monthly':
      start = startOfMonth(now)
      end = endOfMonth(now)
      break
    case 'semiannual':
      start = subMonths(startOfMonth(now), 5)
      end = endOfMonth(now)
      break
    case 'annual':
      start = startOfYear(now)
      end = endOfYear(now)
      break
    case 'custom':
      start = customFrom ? new Date(customFrom) : subDays(now, 30)
      end = customTo ? new Date(customTo) : now
      break
  }
  return {
    start,
    end,
    startStr: format(start, 'yyyy-MM-dd'),
    endStr: format(end, 'yyyy-MM-dd'),
  }
}

function getWeekRange(weekOffset = 0) {
  const base = subWeeks(new Date(), weekOffset)
  const s = startOfWeek(base, { weekStartsOn: 1 })
  const e = endOfWeek(base, { weekStartsOn: 1 })
  return { start: s, end: e, startStr: format(s, 'yyyy-MM-dd'), endStr: format(e, 'yyyy-MM-dd') }
}

function periodLabel(period: PeriodKey, startStr: string, endStr: string): string {
  const s = new Date(startStr)
  const e = new Date(endStr)
  switch (period) {
    case 'daily': return `Aujourd'hui — ${format(s, 'dd MMMM yyyy', { locale: fr })}`
    case 'weekly': return `Semaine du ${format(s, 'dd/MM', { locale: fr })} au ${format(e, 'dd/MM/yyyy', { locale: fr })}`
    case 'monthly': return format(s, 'MMMM yyyy', { locale: fr })
    case 'semiannual': return `${format(s, 'MMM yyyy', { locale: fr })} - ${format(e, 'MMM yyyy', { locale: fr })}`
    case 'annual': return `Année ${format(s, 'yyyy')}`
    case 'custom': return `Du ${format(s, 'dd/MM/yyyy')} au ${format(e, 'dd/MM/yyyy')}`
  }
}

interface FixedByType { name: string; icon: string; color: string; total: number; count: number }

export default function ChargeAchatDashboard() {
  const navigate = useNavigate()

  const [period, setPeriod] = useState<PeriodKey>('weekly')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { startStr, endStr } = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  )
  const label = periodLabel(period, startStr, endStr)

  const [loading, setLoading] = useState(true)
  const [companySums, setCompanySums] = useState<CompanySummary[]>([])
  const [periodTotal, setPeriodTotal] = useState(0)
  const [topVehicles, setTopVehicles] = useState<{ reg: string; company: string; total: number }[]>([])
  const [topCategories, setTopCategories] = useState<{ name: string; icon: string; count: number }[]>([])
  const [trendData, setTrendData] = useState<Record<string, unknown>[]>([])
  const [barData, setBarData] = useState<Record<string, unknown>[]>([])

  const [fixedByType, setFixedByType] = useState<FixedByType[]>([])
  const [fixedTotal, setFixedTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [expRes, fixedRes] = await Promise.all([
        supabase
          .from('vehicle_expenses')
          .select('*, company:companies(name,code), category:expense_categories(name,icon,color)')
          .eq('source', 'charge_achat')
          .gte('expense_date', startStr)
          .lte('expense_date', endStr),
        supabase
          .from('fixed_expenses')
          .select('*, expense_type:fixed_expense_types(name, icon, color)')
          .gte('expense_date', startStr)
          .lte('expense_date', endStr),
      ])

      const exps = (expRes.data ?? []) as VehicleExpense[]
      const fixedExps = (fixedRes.data ?? []) as Array<{
        id: string; amount: number; expense_type_id: string
        expense_type?: { name: string; icon: string; color: string } | null
      }>

      // --- Fixed expenses by type ---
      const byType: Record<string, FixedByType> = {}
      let fTotal = 0
      for (const f of fixedExps) {
        const key = f.expense_type_id
        const name = f.expense_type?.name ?? 'Autre'
        const icon = f.expense_type?.icon ?? '📋'
        const color = f.expense_type?.color ?? '#6B7280'
        if (!byType[key]) byType[key] = { name, icon, color, total: 0, count: 0 }
        byType[key].total += Number(f.amount)
        byType[key].count++
        fTotal += Number(f.amount)
      }
      setFixedByType(Object.values(byType).sort((a, b) => b.total - a.total))
      setFixedTotal(fTotal)

      // --- Vehicle expenses ---
      const byCompany: Record<string, CompanySummary> = {}
      for (const e of exps) {
        const code = e.company?.code ?? '?'
        const name = e.company?.name ?? '?'
        if (!byCompany[code]) byCompany[code] = { company_id: e.company_id, company_name: name, company_code: code, total: 0 }
        byCompany[code].total += Number(e.amount)
      }

      const { data: companiesRaw } = await supabase
        .from('companies')
        .select('id, name, code, parent_id, is_group')
        .order('name')
      const companies = companiesRaw ?? []

      const { groups: companyGroups, standalone } = buildCompanyGroups(companies)

      const groupSums: CompanySummary[] = companyGroups.map(({ group, subsidiaries }) => {
        const subIds = new Set(subsidiaries.map(s => s.id))
        const total = exps
          .filter(e => subIds.has(e.company_id) || e.company_id === group.id)
          .reduce((a, b) => a + Number(b.amount), 0)
        return { company_id: group.id, company_name: group.name, company_code: group.code, total }
      })

      const standaloneSums: CompanySummary[] = standalone.map(c => ({
        company_id: c.id,
        company_name: c.name,
        company_code: c.code,
        total: byCompany[c.code]?.total ?? 0,
      }))

      const sums: CompanySummary[] = [...groupSums, ...standaloneSums]
      setCompanySums(sums)
      setPeriodTotal(sums.reduce((a, b) => a + b.total, 0))

      setBarData(sums.filter(s => s.total > 0).map(s => ({
        name: s.company_code,
        total: s.total,
        fill: COMPANY_COLORS[s.company_code] ?? '#6B7280',
      })))

      // Top 5 vehicles
      const byVehicle: Record<string, { reg: string; company: string; total: number }> = {}
      for (const e of exps) {
        const key = e.registration_number
        if (!byVehicle[key]) byVehicle[key] = { reg: key, company: e.company?.code ?? '', total: 0 }
        byVehicle[key].total += Number(e.amount)
      }
      setTopVehicles(Object.values(byVehicle).sort((a, b) => b.total - a.total).slice(0, 5))

      // Top categories
      const byCat: Record<string, { name: string; icon: string; count: number }> = {}
      for (const e of exps) {
        const key = e.category?.name ?? 'Divers'
        if (!byCat[key]) byCat[key] = { name: key, icon: e.category?.icon ?? '📦', count: 0 }
        byCat[key].count++
      }
      setTopCategories(Object.values(byCat).sort((a, b) => b.count - a.count).slice(0, 5))

      // 8-week trend
      const weeks = Array.from({ length: 8 }, (_, i) => getWeekRange(7 - i))
      const { data: trendExpenses } = await supabase
        .from('vehicle_expenses')
        .select('expense_date, amount, company_id, company:companies(code)')
        .eq('source', 'charge_achat')
        .gte('expense_date', weeks[0].startStr)
        .lte('expense_date', weeks[7].endStr)

      const trendKeys = sums.map(s => ({ id: s.company_id, code: s.company_code, isGroup: companyGroups.some(g => g.group.id === s.company_id) }))
      const subIdsByGroup: Record<string, string[]> = {}
      for (const { group, subsidiaries } of companyGroups) {
        subIdsByGroup[group.id] = [group.id, ...subsidiaries.map(s => s.id)]
      }

      const trend: Record<string, unknown>[] = weeks.map(w => {
        const wLabel = `S${format(w.start, 'dd/MM', { locale: fr })}`
        const row: Record<string, unknown> = { week: wLabel }
        for (const k of trendKeys) {
          const ids = k.isGroup ? (subIdsByGroup[k.id] ?? [k.id]) : [k.id]
          const sum = (trendExpenses ?? [])
            .filter(e => {
              const d = e.expense_date as string
              return d >= w.startStr && d <= w.endStr && ids.includes(e.company_id)
            })
            .reduce((a, b) => a + Number(b.amount), 0)
          row[k.code] = sum
        }
        return row
      })
      setTrendData(trend)
    } finally {
      setLoading(false)
    }
  }, [startStr, endStr])

  useEffect(() => { load() }, [load])

  const fixedPieData = fixedByType.map((t, i) => ({
    name: t.name,
    value: t.total,
    color: t.color || PIE_COLORS[i % PIE_COLORS.length],
  }))

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Tableau de bord
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Actualiser">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
          <button
            onClick={() => navigate('/charge-achat/expenses/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
            style={{ backgroundColor: '#0B7439', color: '#fff' }}
          >
            <Plus className="w-4 h-4" />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Period selector */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: period === p.key ? '#0B7439' : 'var(--bg-subtle)',
                color: period === p.key ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${period === p.key ? '#0B7439' : 'var(--border)'}`,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Du</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Au</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Company KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* Totals row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#0B7439,#085c2d)', color: '#fff' }}
            >
              <div>
                <p className="text-xs opacity-80">Charges variables</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{fmt(periodTotal)}</p>
                <p className="text-xs opacity-60 mt-1">{label}</p>
              </div>
              <BarChart2 className="w-10 h-10 opacity-20" />
            </div>
            <div
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg,#D97706,#b45309)', color: '#fff' }}
            >
              <div>
                <p className="text-xs opacity-80">Charges fixes</p>
                <p className="text-2xl sm:text-3xl font-bold mt-1">{fmt(fixedTotal)}</p>
                <p className="text-xs opacity-60 mt-1">{fixedByType.length} type{fixedByType.length > 1 ? 's' : ''}</p>
              </div>
              <Zap className="w-10 h-10 opacity-20" />
            </div>
          </div>

          {/* Per company */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {companySums.map(c => (
              <button
                key={c.company_id}
                onClick={() => navigate(`/charge-achat/expenses?company=${c.company_id}`)}
                className="rounded-xl p-3 text-left hover:shadow-md transition-all"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-2"
                  style={{ backgroundColor: COMPANY_COLORS[c.company_code] ? COMPANY_COLORS[c.company_code] + '20' : '#F3F4F6', color: COMPANY_COLORS[c.company_code] ?? '#6B7280' }}
                >
                  {c.company_code}
                </div>
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {c.total > 0 ? fmt(c.total) : '0 XOF'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.company_name}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Fixed expenses by type */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" style={{ color: '#D97706' }} />
                <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Charges fixes par type
                </h2>
              </div>
              <button
                onClick={() => navigate('/charge-achat/fixed-expenses-report')}
                className="text-xs flex items-center gap-1"
                style={{ color: '#0B7439' }}
              >
                Rapport <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {fixedByType.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune charge fixe sur cette période</p>
            ) : (
              <div className="space-y-2.5">
                {fixedByType.map(t => {
                  const pct = fixedTotal > 0 ? (t.total / fixedTotal) * 100 : 0
                  return (
                    <div key={t.name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base flex-shrink-0">{t.icon}</span>
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>({t.count})</span>
                        </div>
                        <span className="text-xs font-bold flex-shrink-0 ml-2" style={{ color: '#AF3029' }}>{fmt(t.total)}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: t.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pie chart */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Répartition charges fixes
            </h2>
            {fixedPieData.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={fixedPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {fixedPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value: string) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Dépenses variables par société
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => (v / 1000) + 'k'} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="total" fill="#0B7439" radius={[4, 4, 0, 0]}>
                {barData.map((entry, idx) => (
                  <rect key={idx} fill={String(entry.fill)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Évolution sur 8 semaines
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => (v / 1000) + 'k'} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {companySums.map(s => (
                <Line
                  key={s.company_code}
                  type="monotone"
                  dataKey={s.company_code}
                  stroke={COMPANY_COLORS[s.company_code] ?? '#6B7280'}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 + Categories row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              Top 5 véhicules coûteux
            </h2>
            <button
              onClick={() => navigate('/charge-achat/fleet')}
              className="text-xs flex items-center gap-1"
              style={{ color: '#0B7439' }}
            >
              Voir flotte <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {topVehicles.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
            ) : topVehicles.map((v, i) => (
              <div key={v.reg} className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: i === 0 ? '#FEF3C7' : 'var(--bg-subtle)', color: i === 0 ? '#D97706' : 'var(--text-muted)' }}
                >
                  {i + 1}
                </span>
                <Car className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-bold truncate" style={{ color: 'var(--text-primary)' }}>{v.reg}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{v.company}</p>
                </div>
                <span
                  className="text-sm font-bold flex-shrink-0"
                  style={{ color: v.total >= 200000 ? '#DC2626' : v.total >= 50000 ? '#D97706' : '#0B7439' }}
                >
                  {fmt(v.total)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Top catégories de dépenses
          </h2>
          <div className="space-y-2">
            {topCategories.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
            ) : topCategories.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="text-xl w-7 text-center flex-shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                >
                  {c.count} fois
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Saisir dépense', path: '/charge-achat/expenses/new', icon: <Plus className="w-5 h-5" />, color: '#0B7439', bg: '#d4edda' },
          { label: 'Charges fixes', path: '/charge-achat/fixed-expenses', icon: <Zap className="w-5 h-5" />, color: '#D97706', bg: '#FEF3C7' },
          { label: 'Vue flotte', path: '/charge-achat/fleet', icon: <Car className="w-5 h-5" />, color: '#1D6FA4', bg: '#DBEAFE' },
          { label: 'Rapport hebdo', path: '/charge-achat/report', icon: <TrendingUp className="w-5 h-5" />, color: '#0B7439', bg: '#d4edda' },
        ].map(a => (
          <button
            key={a.path}
            onClick={() => navigate(a.path)}
            className="rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all text-left"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.bg, color: a.color }}>
              {a.icon}
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
