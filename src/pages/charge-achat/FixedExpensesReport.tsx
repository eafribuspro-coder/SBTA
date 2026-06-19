import { useState, useEffect } from 'react'
import { Download, Calendar, Filter, Building2, MapPin, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, subMonths } from 'date-fns'
import { supabase } from '@/services/supabase'
import type { FixedExpense, FixedExpenseType } from '@/types/chargeAchat.types'

interface GarageOption { id: string; name: string; city: string; region: string | null }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

export default function FixedExpensesReport() {
  const [expenses, setExpenses] = useState<FixedExpense[]>([])
  const [types, setTypes] = useState<FixedExpenseType[]>([])
  const [garages, setGarages] = useState<GarageOption[]>([])
  const [loading, setLoading] = useState(true)

  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [typeFilter, setTypeFilter] = useState('')
  const [garageFilter, setGarageFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [expRes, typesRes, garagesRes] = await Promise.all([
      supabase.from('fixed_expenses')
        .select('*, expense_type:fixed_expense_types(*), garage:garages(id, name, city, region)')
        .gte('expense_date', dateFrom).lte('expense_date', dateTo)
        .order('expense_date', { ascending: false }),
      supabase.from('fixed_expense_types').select('*').order('sort_order'),
      supabase.from('garages').select('id, name, city, region').order('name'),
    ])
    if (expRes.data) setExpenses(expRes.data as FixedExpense[])
    if (typesRes.data) setTypes(typesRes.data as FixedExpenseType[])
    if (garagesRes.data) setGarages(garagesRes.data as GarageOption[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  const filtered = expenses.filter(e => {
    if (typeFilter && e.expense_type_id !== typeFilter) return false
    if (garageFilter && e.garage_id !== garageFilter) return false
    return true
  })

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  // Group by type
  const byType = new Map<string, { type: FixedExpenseType; total: number; count: number }>()
  filtered.forEach(e => {
    const key = e.expense_type_id
    const prev = byType.get(key)
    if (prev) {
      prev.total += Number(e.amount); prev.count++
    } else {
      byType.set(key, { type: e.expense_type ?? { id: key, name: '?', icon: '📋', color: '#6B7280', is_active: true, sort_order: 0, created_at: '', updated_at: '' }, total: Number(e.amount), count: 1 })
    }
  })
  const typeRows = [...byType.values()].sort((a, b) => b.total - a.total)

  // Group by garage
  const byGarage = new Map<string, { name: string; city: string; total: number; count: number }>()
  filtered.forEach(e => {
    const key = e.garage_id ?? 'none'
    const prev = byGarage.get(key)
    const name = e.garage?.name ?? 'Sans garage'
    const city = e.garage?.city ?? ''
    if (prev) { prev.total += Number(e.amount); prev.count++ }
    else { byGarage.set(key, { name, city, total: Number(e.amount), count: 1 }) }
  })
  const garageRows = [...byGarage.values()].sort((a, b) => b.total - a.total)

  // Group by zone
  const byZone = new Map<string, { total: number; count: number }>()
  filtered.forEach(e => {
    const key = e.zone || e.garage?.city || 'Non defini'
    const prev = byZone.get(key)
    if (prev) { prev.total += Number(e.amount); prev.count++ }
    else { byZone.set(key, { total: Number(e.amount), count: 1 }) }
  })
  const zoneRows = [...byZone.entries()].sort((a, b) => b[1].total - a[1].total)

  const exportCSV = () => {
    const headers = ['Type', 'Garage', 'Zone', 'Date', 'Fournisseur', 'Ref. facture', 'Montant']
    const rows = filtered.map(e => [
      e.expense_type?.name ?? '', e.garage?.name ?? '', e.zone ?? '',
      new Date(e.expense_date).toLocaleDateString('fr-FR'),
      e.supplier ?? '', e.invoice_reference ?? '', String(e.amount),
    ])
    const content = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `rapport_charges_fixes_${dateFrom}_${dateTo}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Export CSV genere')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Rapport charges fixes</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Analyse par type, garage et zone</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#0B7439' }}>
          <Download className="w-4 h-4" />Exporter CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 rounded-xl p-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>au</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">Tous types</option>
          {types.filter(t => t.is_active).map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
        <select value={garageFilter} onChange={e => setGarageFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <option value="">Tous garages</option>
          {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: '#0B743910', border: '1px solid #0B743930' }}>
          <p className="text-xs font-medium" style={{ color: '#0B7439' }}>Total periode</p>
          <p className="text-xl font-bold" style={{ color: '#0B7439' }}>{fmt(total)} F</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nb depenses</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{filtered.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Moyenne / depense</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{filtered.length ? fmt(Math.round(total / filtered.length)) : '0'} F</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Types de charges</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{typeRows.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By type */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-4 h-4" style={{ color: '#F59E0B' }} />Par type de depense
          </h3>
          <div className="space-y-2">
            {typeRows.map(r => {
              const pct = total > 0 ? (r.total / total) * 100 : 0
              return (
                <div key={r.type.id} className="flex items-center gap-3">
                  <span className="text-lg w-8 text-center">{r.type.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.type.name}</span>
                      <span className="text-xs font-bold ml-2" style={{ color: r.type.color }}>{fmt(r.total)} F</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: r.type.color }} />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.count} depense{r.count > 1 ? 's' : ''} - {pct.toFixed(1)}%</p>
                  </div>
                </div>
              )
            })}
            {typeRows.length === 0 && <p className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Aucune donnee</p>}
          </div>
        </div>

        {/* By garage */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Building2 className="w-4 h-4" style={{ color: '#1D6FA4' }} />Par garage
          </h3>
          <div className="space-y-2">
            {garageRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.city} - {r.count} depense{r.count > 1 ? 's' : ''}</p>
                </div>
                <p className="font-bold text-sm" style={{ color: '#AF3029' }}>{fmt(r.total)} F</p>
              </div>
            ))}
            {garageRows.length === 0 && <p className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>Aucune donnee</p>}
          </div>
        </div>

        {/* By zone */}
        <div className="rounded-xl p-5 lg:col-span-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <MapPin className="w-4 h-4" style={{ color: '#D97706' }} />Par zone / secteur
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {zoneRows.map(([zone, data], i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{zone}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.count} depense{data.count > 1 ? 's' : ''}</p>
                </div>
                <p className="font-bold text-sm" style={{ color: '#AF3029' }}>{fmt(data.total)} F</p>
              </div>
            ))}
            {zoneRows.length === 0 && <p className="text-center py-4 text-sm col-span-full" style={{ color: 'var(--text-muted)' }}>Aucune donnee</p>}
          </div>
        </div>
      </div>

      {/* Detail table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Detail des depenses</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-subtle)' }}>
              <tr>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Date</th>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Garage</th>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Zone</th>
                <th className="text-left px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Fournisseur</th>
                <th className="text-right px-4 py-2" style={{ color: 'var(--text-secondary)' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(e => (
                <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2">{e.expense_type?.icon} {e.expense_type?.name}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{e.garage?.name ?? '-'}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{e.zone ?? '-'}</td>
                  <td className="px-4 py-2" style={{ color: 'var(--text-secondary)' }}>{e.supplier ?? '-'}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: '#AF3029' }}>{fmt(Number(e.amount))} F</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Aucune depense sur cette periode</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
