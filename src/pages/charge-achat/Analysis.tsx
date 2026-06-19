import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import type { VehicleExpense } from '@/types/chargeAchat.types'
import { buildCompanyGroups, resolveCompanyIds } from '@/utils/companyGroups'
import type { CompanyWithHierarchy } from '@/utils/companyGroups'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

const COLORS = ['#0B7439', '#1D6FA4', '#D97706', '#DC2626', '#059669', '#6B7280', '#F59E0B', '#EF4444', '#10B981']

const COMPANY_COLORS: Record<string, string> = {
  SBTA: '#0B7439', TST: '#1D6FA4', ETL: '#D97706', SNT: '#9CA3AF', 'G-OUMÉ': '#059669',
}

export default function Analysis() {
  const [period,      setPeriod]      = useState<Period>('this_week')
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')
  const [loading,     setLoading]     = useState(true)
  const [expenses,    setExpenses]    = useState<VehicleExpense[]>([])
  const [companies,   setCompanies]   = useState<CompanyWithHierarchy[]>([])

  const getRange = useCallback(() => {
    const now = new Date()
    switch (period) {
      case 'this_week':
        return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
      case 'last_week': {
        const lw = subWeeks(now, 1)
        return { from: format(startOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(lw, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
      }
      case 'this_month':
        return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
      case 'last_month': {
        const lm = subMonths(now, 1)
        return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }
      }
      case 'custom':
        return { from: customFrom, to: customTo }
    }
  }, [period, customFrom, customTo])

  const load = useCallback(async () => {
    const { from, to } = getRange()
    if (!from || !to) return
    setLoading(true)
    try {
      const [{ data: exps }, { data: cos }] = await Promise.all([
        supabase.from('vehicle_expenses')
          .select('*, company:companies(name,code), category:expense_categories(name,icon,color)')
          .eq('source', 'charge_achat')
          .gte('expense_date', from)
          .lte('expense_date', to),
        supabase.from('companies').select('id,name,code,parent_id,is_group').order('name'),
      ])
      setExpenses((exps ?? []) as VehicleExpense[])
      setCompanies((cos ?? []) as CompanyWithHierarchy[])
    } finally {
      setLoading(false)
    }
  }, [getRange])

  useEffect(() => { load() }, [load])

  const { groups: companyGroups, standalone } = buildCompanyGroups(companies)

  // Consolidated display entities: group + standalone (no individual subsidiaries)
  const displayEntities: { id: string; code: string; name: string; ids: string[] }[] = [
    ...companyGroups.map(({ group, subsidiaries }) => ({
      id: group.id, code: group.code, name: group.name,
      ids: [group.id, ...subsidiaries.map(s => s.id)],
    })),
    ...standalone.map(c => ({ id: c.id, code: c.code, name: c.name, ids: [c.id] })),
  ]

  const grandTotal = expenses.reduce((a, b) => a + Number(b.amount), 0)

  // Category pie data
  const catMap: Record<string, { name: string; icon: string; value: number }> = {}
  for (const e of expenses) {
    const key = e.category?.name ?? 'Divers'
    if (!catMap[key]) catMap[key] = { name: key, icon: (e as any).category?.icon ?? '📦', value: 0 }
    catMap[key].value += Number(e.amount)
  }
  const catData = Object.values(catMap).sort((a, b) => b.value - a.value)

  // Company bar data — consolidated
  const companyData = displayEntities
    .map(entity => ({
      name: entity.code,
      total: expenses.filter(e => entity.ids.includes(e.company_id)).reduce((a, b) => a + Number(b.amount), 0),
    }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)

  // Top 10 vehicles
  const vehicleMap: Record<string, { reg: string; company: string; total: number }> = {}
  for (const e of expenses) {
    const key = e.registration_number
    // Use consolidated company code (group if subsidiary)
    const subParent = companyGroups.find(g => g.subsidiaries.some(s => s.id === e.company_id))
    const companyCode = subParent ? subParent.group.code : ((e as any).company?.code ?? '')
    if (!vehicleMap[key]) vehicleMap[key] = { reg: key, company: companyCode, total: 0 }
    vehicleMap[key].total += Number(e.amount)
  }
  const top10 = Object.values(vehicleMap).sort((a, b) => b.total - a.total).slice(0, 10)

  // Anomaly: vehicles > 200 000 XOF
  const anomalies = top10.filter(v => v.total >= 200000)

  // Monthly comparison (last 6 months) — consolidated
  const now = new Date()
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(now, 5 - i)
    const from = format(startOfMonth(m), 'yyyy-MM-dd')
    const to   = format(endOfMonth(m), 'yyyy-MM-dd')
    const row: Record<string, unknown> = { month: format(m, 'MMM yy', { locale: fr }) }
    for (const entity of displayEntities) {
      row[entity.code] = expenses
        .filter(e => e.expense_date >= from && e.expense_date <= to && entity.ids.includes(e.company_id))
        .reduce((a, b) => a + Number(b.amount), 0)
    }
    return row
  })

  const periodLabel = (() => {
    const r = getRange()
    return r.from && r.to ? `Du ${format(new Date(r.from), 'dd/MM/yyyy', { locale: fr })} au ${format(new Date(r.to), 'dd/MM/yyyy', { locale: fr })}` : '—'
  })()

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Analyse des dépenses</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{periodLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total période</p>
          <p className="text-xl font-bold" style={{ color: '#0B7439' }}>{fmt(grandTotal)}</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { value: 'this_week',  label: 'Cette semaine' },
          { value: 'last_week',  label: 'Sem. dernière' },
          { value: 'this_month', label: 'Ce mois' },
          { value: 'last_month', label: 'Mois dernier' },
          { value: 'custom',     label: 'Personnalisé' },
        ] as { value: Period; label: string }[]).map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: period === p.value ? '#0B7439' : 'var(--bg-subtle)',
              color: period === p.value ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            {p.label}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        )}
      </div>

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: '#DC2626' }} />
            <span className="text-sm font-bold" style={{ color: '#991B1B' }}>
              Alertes anomalie — {anomalies.length} véhicule{anomalies.length > 1 ? 's' : ''} dépassant 200 000 XOF
            </span>
          </div>
          <div className="space-y-1.5">
            {anomalies.map(v => (
              <div key={v.reg} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm" style={{ color: '#991B1B' }}>{v.reg}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fee2e2', color: '#991B1B' }}>{v.company}</span>
                </div>
                <span className="font-bold text-sm" style={{ color: '#DC2626' }}>{fmt(v.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-7 h-7 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Category pie */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Répartition par catégorie
              </h2>
              {catData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
              ) : (
                <div className="flex gap-4 items-center flex-wrap">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                        {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {catData.slice(0, 8).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{c.icon} {c.name}</span>
                        <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                          {grandTotal > 0 ? ((c.value / grandTotal) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Company bar — consolidated */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Répartition par société
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={companyData} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickFormatter={v => (v / 1000) + 'k'} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {companyData.map((entry, i) => (
                      <Cell key={i} fill={COMPANY_COLORS[entry.name] ?? COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 vehicles horizontal bar */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              10 véhicules les plus coûteux
            </h2>
            <div className="space-y-2">
              {top10.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
              ) : top10.map((v, i) => {
                const pct = top10[0].total > 0 ? (v.total / top10[0].total) * 100 : 0
                const isAnomaly = v.total >= 200000
                return (
                  <div key={v.reg} className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                    <span className="font-mono text-xs font-bold w-28 flex-shrink-0" style={{ color: isAnomaly ? '#DC2626' : 'var(--text-primary)' }}>{v.reg}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: '#d4edda', color: '#0B7439', fontSize: '0.6rem' }}>{v.company}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: isAnomaly ? '#DC2626' : '#0B7439' }}
                      />
                    </div>
                    <span className="text-xs font-bold flex-shrink-0 w-28 text-right" style={{ color: isAnomaly ? '#DC2626' : 'var(--text-primary)' }}>
                      {fmt(v.total)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Monthly comparison table — consolidated */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <div className="px-4 py-3" style={{ backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Comparatif mensuel par société (6 derniers mois)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]" style={{ backgroundColor: 'var(--surface)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Société</th>
                    {monthlyData.map(m => (
                      <th key={String(m.month)} className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {String(m.month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {displayEntities.map(entity => (
                    <tr key={entity.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{entity.code}</td>
                      {monthlyData.map(m => {
                        const val = Number(m[entity.code] ?? 0)
                        return (
                          <td key={String(m.month)} className="px-3 py-2 text-right text-xs" style={{ color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {val > 0 ? new Intl.NumberFormat('fr-FR').format(val) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--text-primary)' }}>TOTAL</td>
                    {monthlyData.map(m => {
                      const tot = displayEntities.reduce((a, entity) => a + Number(m[entity.code] ?? 0), 0)
                      return (
                        <td key={String(m.month)} className="px-3 py-2 text-right text-xs font-bold" style={{ color: '#0B7439' }}>
                          {tot > 0 ? new Intl.NumberFormat('fr-FR').format(tot) : '—'}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Weekly average — consolidated */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4" style={{ color: '#0B7439' }} />
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Dépenses moyennes hebdomadaires par société</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {displayEntities.map(entity => {
                const total = expenses.filter(e => entity.ids.includes(e.company_id)).reduce((a, b) => a + Number(b.amount), 0)
                if (total === 0) return null
                const weekAvg = Math.round(total / Math.max(1, 4))
                return (
                  <div key={entity.id} className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#0B7439' }}>{entity.code}</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      {new Intl.NumberFormat('fr-FR').format(weekAvg)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>XOF/semaine</p>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
