import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Plus, TrendingUp, Car, BarChart2,
  RefreshCw, ChevronRight, Calendar, Wallet, Package, ArrowUpDown,
  Building2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts'
import { format, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import type { VehicleExpense, CompanySummary } from '@/types/chargeAchat.types'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

function getWeekRange(weekOffset = 0) {
  const base = subWeeks(new Date(), weekOffset)
  const start = startOfWeek(base, { weekStartsOn: 1 })
  const end   = endOfWeek(base,   { weekStartsOn: 1 })
  return { start, end, startStr: format(start, 'yyyy-MM-dd'), endStr: format(end, 'yyyy-MM-dd') }
}

interface CompanyInfo { id: string; name: string; code: string }

export default function ComptableNewDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const companyId = user?.company_id ?? null

  const { start, end, startStr, endStr } = getWeekRange(0)

  const [loading,         setLoading]         = useState(true)
  const [company,         setCompany]         = useState<CompanyInfo | null>(null)
  const [weekTotal,       setWeekTotal]        = useState(0)
  const [topVehicles,     setTopVehicles]      = useState<{ reg: string; total: number }[]>([])
  const [trendData,       setTrendData]        = useState<Record<string, unknown>[]>([])
  const [barData,         setBarData]          = useState<Record<string, unknown>[]>([])
  const [caisseBalance,   setCaisseBalance]    = useState<{ entrees: number; depenses: number } | null>(null)
  const [monthTotal,      setMonthTotal]       = useState<number | null>(null)
  const [stockAlerts,     setStockAlerts]      = useState(0)

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return }
    setLoading(true)
    try {
      // Load company info
      const { data: coData } = await supabase
        .from('companies').select('id, name, code').eq('id', companyId).maybeSingle()
      if (coData) setCompany(coData as CompanyInfo)

      // Get buses of this company
      const { data: busData } = await supabase.from('buses').select('id').eq('company_id', companyId)
      const busIds = (busData ?? []).map(b => b.id)

      // Current week expenses
      let exps: VehicleExpense[] = []
      if (busIds.length > 0) {
        const { data } = await supabase
          .from('vehicle_expenses')
          .select('*, category:expense_categories(name,icon,color)')
          .gte('expense_date', startStr)
          .lte('expense_date', endStr)
          .eq('company_id', companyId)
          .eq('source', 'comptable')
        exps = (data ?? []) as VehicleExpense[]
      }

      const total = exps.reduce((a, b) => a + Number(b.amount), 0)
      setWeekTotal(total)

      // Bar data by category
      const byCat: Record<string, number> = {}
      for (const e of exps) {
        const k = (e as any).category?.name ?? 'Divers'
        byCat[k] = (byCat[k] ?? 0) + Number(e.amount)
      }
      setBarData(
        Object.entries(byCat)
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6)
      )

      // Top 5 vehicles
      const byVeh: Record<string, number> = {}
      for (const e of exps) {
        byVeh[e.registration_number] = (byVeh[e.registration_number] ?? 0) + Number(e.amount)
      }
      setTopVehicles(
        Object.entries(byVeh).map(([reg, total]) => ({ reg, total })).sort((a, b) => b.total - a.total).slice(0, 5)
      )

      // 8-week trend
      const weeks = Array.from({ length: 8 }, (_, i) => getWeekRange(7 - i))
      const { data: trendExps } = await supabase
        .from('vehicle_expenses')
        .select('expense_date, amount')
        .eq('company_id', companyId)
        .eq('source', 'comptable')
        .gte('expense_date', weeks[0].startStr)
        .lte('expense_date', weeks[7].endStr)

      const trend = weeks.map(w => ({
        week: `S${format(w.start, 'dd/MM', { locale: fr })}`,
        total: (trendExps ?? []).filter(e => e.expense_date >= w.startStr && e.expense_date <= w.endStr).reduce((a, b) => a + Number(b.amount), 0),
      }))
      setTrendData(trend)

      // Caisse this week
      const { data: caisseData } = await supabase
        .from('comptable_caisse_entries')
        .select('entry_type, amount')
        .eq('company_id', companyId)
        .gte('entry_date', startStr)
        .lte('entry_date', endStr)

      const entrees  = (caisseData ?? []).filter(c => c.entry_type === 'entree').reduce((a, b) => a + Number(b.amount), 0)
      const depenses = (caisseData ?? []).filter(c => c.entry_type === 'depense').reduce((a, b) => a + Number(b.amount), 0)
      setCaisseBalance({ entrees, depenses })

      // Monthly expenses (current month)
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const monthEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd')
      if (busIds.length > 0) {
        const { data: monthData } = await supabase
          .from('vehicle_expenses')
          .select('amount')
          .eq('company_id', companyId)
          .eq('source', 'comptable')
          .gte('expense_date', monthStart)
          .lte('expense_date', monthEnd)
        setMonthTotal((monthData ?? []).reduce((a, b) => a + Number(b.amount), 0))
      } else {
        setMonthTotal(0)
      }

      // Stock alerts (stock final < stock_min)
      const { data: stockItems } = await supabase
        .from('comptable_stock_items')
        .select('id, stock_initial, stock_min')
        .eq('company_id', companyId)

      if (stockItems && stockItems.length > 0) {
        const itemIds = stockItems.map(s => s.id)
        const { data: mvts } = await supabase
          .from('comptable_stock_movements')
          .select('stock_item_id, movement_type, quantity')
          .in('stock_item_id', itemIds)

        let alerts = 0
        for (const item of stockItems) {
          const itemMvts = (mvts ?? []).filter(m => m.stock_item_id === item.id)
          const entrees  = itemMvts.filter(m => m.movement_type === 'entree').reduce((a, b) => a + Number(b.quantity), 0)
          const sorties  = itemMvts.filter(m => m.movement_type === 'sortie').reduce((a, b) => a + Number(b.quantity), 0)
          const stockFinal = Number(item.stock_initial) + entrees - sorties
          if (stockFinal < Number(item.stock_min)) alerts++
        }
        setStockAlerts(alerts)
      }
    } finally {
      setLoading(false)
    }
  }, [companyId, startStr, endStr])

  useEffect(() => { load() }, [load])

  const weekLabel = `Semaine du ${format(start, 'dd/MM', { locale: fr })} au ${format(end, 'dd/MM/yyyy', { locale: fr })}`
  const caisseReste = caisseBalance ? caisseBalance.entrees - caisseBalance.depenses : 0

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Tableau de bord
          </h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{weekLabel}</p>
            {company && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <Building2 className="w-3.5 h-3.5" style={{ color: '#1D4ED8' }} />
                <span className="text-xs font-bold" style={{ color: '#1E3A5F' }}>{company.name}</span>
                <span className="text-xs font-mono font-bold px-1 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{company.code}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Actualiser">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
          <button
            onClick={() => navigate('/comptable/expenses/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
            style={{ backgroundColor: '#0B7439', color: '#fff' }}
          >
            <Plus className="w-4 h-4" />
            Nouvelle dépense
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total dépenses semaine */}
            <div className="rounded-2xl p-4 flex flex-col justify-between col-span-2 lg:col-span-1"
              style={{ background: 'linear-gradient(135deg,#0B7439,#085c2d)', color: '#fff' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs opacity-80">Dépenses — semaine</p>
                <BarChart2 className="w-5 h-5 opacity-40" />
              </div>
              <p className="text-2xl font-bold mt-2">{fmt(weekTotal)}</p>
            </div>

            {/* Dépenses du mois */}
            <div className="rounded-2xl p-4 flex flex-col justify-between"
              style={{ backgroundColor: '#DBEAFE', border: '1px solid #93C5FD' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: '#1E3A5F' }}>Dépenses du mois</p>
                <TrendingUp className="w-4 h-4" style={{ color: '#1D4ED8' }} />
              </div>
              <p className="text-xl font-bold mt-1" style={{ color: '#1D4ED8' }}>
                {monthTotal !== null ? fmt(monthTotal) : '—'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#1E3A5F' }}>{format(new Date(), 'MMMM yyyy', { locale: fr })}</p>
            </div>

            {/* Caisse — Reste */}
            <div className="rounded-2xl p-4 flex flex-col justify-between"
              style={{
                backgroundColor: caisseReste >= 0 ? '#d4edda' : '#fee2e2',
                border: `1px solid ${caisseReste >= 0 ? '#86efac' : '#fca5a5'}`,
              }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: caisseReste >= 0 ? '#065f46' : '#991B1B' }}>Reste caisse</p>
                <Wallet className="w-4 h-4" style={{ color: caisseReste >= 0 ? '#0B7439' : '#DC2626' }} />
              </div>
              <p className="text-xl font-bold mt-1" style={{ color: caisseReste >= 0 ? '#0B7439' : '#DC2626' }}>
                {caisseBalance ? fmt(caisseReste) : '—'}
              </p>
              <p className="text-xs mt-1" style={{ color: caisseReste >= 0 ? '#065f46' : '#991B1B' }}>
                {caisseBalance ? fmt(caisseBalance.depenses) + ' dépensés' : 'cette semaine'}
              </p>
            </div>

            {/* Alertes stock */}
            <div className="rounded-2xl p-4 flex flex-col justify-between"
              style={{
                backgroundColor: stockAlerts > 0 ? '#FEF3C7' : '#EFF6FF',
                border: `1px solid ${stockAlerts > 0 ? '#FCD34D' : '#BFDBFE'}`,
              }}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: stockAlerts > 0 ? '#92400E' : '#1E3A5F' }}>Alertes stock</p>
                <Package className="w-4 h-4" style={{ color: stockAlerts > 0 ? '#D97706' : '#1D4ED8' }} />
              </div>
              <p className="text-xl font-bold mt-1" style={{ color: stockAlerts > 0 ? '#D97706' : '#1D4ED8' }}>
                {stockAlerts} article{stockAlerts !== 1 ? 's' : ''}
              </p>
              <p className="text-xs mt-1" style={{ color: stockAlerts > 0 ? '#92400E' : '#1E3A5F' }}>
                {stockAlerts > 0 ? 'sous le seuil min' : 'stocks OK'}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar by category */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Dépenses par catégorie — semaine
              </h2>
              {barData.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune dépense cette semaine</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => (v / 1000) + 'k'} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="total" fill="#0B7439" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* 8-week trend */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
                Évolution sur 8 semaines
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => (v / 1000) + 'k'} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="total" stroke="#0B7439" strokeWidth={2} dot={false} name="Dépenses" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 5 vehicles */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Top 5 véhicules coûteux</h2>
              <button onClick={() => navigate('/comptable/fleet')} className="text-xs flex items-center gap-1" style={{ color: '#0B7439' }}>
                Voir flotte <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            {topVehicles.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Aucune donnée cette semaine</p>
            ) : (
              <div className="space-y-2">
                {topVehicles.map((v, i) => (
                  <div key={v.reg} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: i === 0 ? '#FEF3C7' : 'var(--bg-subtle)', color: i === 0 ? '#D97706' : 'var(--text-muted)' }}>
                      {i + 1}
                    </span>
                    <Car className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm font-mono font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{v.reg}</p>
                    <span className="text-sm font-bold" style={{ color: v.total >= 200000 ? '#DC2626' : v.total >= 50000 ? '#D97706' : '#0B7439' }}>
                      {fmt(v.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Saisir dépense',   path: '/comptable/expenses/new',  icon: <Plus className="w-5 h-5" />,            color: '#0B7439', bg: '#d4edda' },
              { label: 'Liste dépenses',   path: '/comptable/expenses',       icon: <LayoutDashboard className="w-5 h-5" />, color: '#1D6FA4', bg: '#DBEAFE' },
              { label: 'Flotte',           path: '/comptable/fleet',          icon: <Car className="w-5 h-5" />,             color: '#D97706', bg: '#FEF3C7' },
              { label: 'Stock',            path: '/comptable/stock',          icon: <Package className="w-5 h-5" />,         color: '#6B7280', bg: '#F3F4F6' },
            ].map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                className="rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all text-left"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: a.bg, color: a.color }}>
                  {a.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
