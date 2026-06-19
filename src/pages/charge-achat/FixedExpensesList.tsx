import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, CreditCard as Edit2, Trash2, Download, Filter, ChevronLeft, ChevronRight, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import type { FixedExpense, FixedExpenseType } from '@/types/chargeAchat.types'

interface GarageOption { id: string; name: string; city: string; region: string | null }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const PAGE_SIZE = 20

export default function FixedExpensesList() {
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState<FixedExpense[]>([])
  const [types, setTypes] = useState<FixedExpenseType[]>([])
  const [garages, setGarages] = useState<GarageOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [garageFilter, setGarageFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(0)

  const loadData = async () => {
    setLoading(true)
    try {
      const [expRes, typesRes, garagesRes] = await Promise.all([
        supabase.from('fixed_expenses')
          .select('*, expense_type:fixed_expense_types(*), garage:garages(id, name, city, region)')
          .order('expense_date', { ascending: false }),
        supabase.from('fixed_expense_types').select('*').order('sort_order'),
        supabase.from('garages').select('id, name, city, region').order('name'),
      ])
      if (expRes.data) setExpenses(expRes.data as FixedExpense[])
      if (typesRes.data) setTypes(typesRes.data as FixedExpenseType[])
      if (garagesRes.data) setGarages(garagesRes.data as GarageOption[])
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette charge fixe ?')) return
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Charge supprimee')
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filtered = expenses.filter(e => {
    if (typeFilter && e.expense_type_id !== typeFilter) return false
    if (garageFilter && e.garage_id !== garageFilter) return false
    if (dateFrom && e.expense_date < dateFrom) return false
    if (dateTo && e.expense_date > dateTo) return false
    if (search) {
      const q = search.toLowerCase()
      const typeName = e.expense_type?.name?.toLowerCase() ?? ''
      const garageName = e.garage?.name?.toLowerCase() ?? ''
      const supplier = (e.supplier ?? '').toLowerCase()
      const zone = (e.zone ?? '').toLowerCase()
      if (!typeName.includes(q) && !garageName.includes(q) && !supplier.includes(q) && !zone.includes(q)) return false
    }
    return true
  })

  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'Garage', 'Zone', 'Fournisseur', 'Ref. facture', 'Montant', 'Observation']
    const rows = filtered.map(e => [
      new Date(e.expense_date).toLocaleDateString('fr-FR'),
      e.expense_type?.name ?? '', e.garage?.name ?? '', e.zone ?? '',
      e.supplier ?? '', e.invoice_reference ?? '', String(e.amount), e.observation ?? '',
    ])
    const content = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `charges_fixes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    toast.success('Export CSV genere')
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]">
      <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Charges fixes</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Electricite, eau, loyer, internet et autres charges fixes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Download className="w-3.5 h-3.5" />Export
          </button>
          <button onClick={() => navigate('/charge-achat/fixed-expenses/new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#0B7439' }}>
            <Plus className="w-4 h-4" />Nouvelle charge fixe
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total charges</p>
          <p className="text-lg font-bold" style={{ color: '#0B7439' }}>{fmt(total)} F</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nb depenses</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{filtered.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Types utilises</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {new Set(filtered.map(e => e.expense_type_id)).size}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Garages couverts</p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {new Set(filtered.filter(e => e.garage_id).map(e => e.garage_id)).size}
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Rechercher par type, garage, fournisseur, zone..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
            style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ backgroundColor: showFilters ? '#0B743910' : 'var(--bg-subtle)', border: '1px solid var(--border)', color: showFilters ? '#0B7439' : 'var(--text-secondary)' }}>
          <Filter className="w-3.5 h-3.5" />Filtres
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="">Tous</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Garage</label>
            <select value={garageFilter} onChange={e => { setGarageFilter(e.target.value); setPage(0) }}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="">Tous</option>
              {garages.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Du</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>Au</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="w-full px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Garage</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Zone</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Fournisseur</th>
                <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Montant</th>
                <th className="text-center px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aucune charge fixe</td></tr>
              ) : paged.map(e => (
                <tr key={e.id} className="border-t hover:bg-gray-50/50 transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{new Date(e.expense_date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{e.expense_type?.icon ?? '📋'}</span>
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{e.expense_type?.name ?? '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.garage?.name ?? '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.zone ?? '-'}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.supplier ?? '-'}</td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#AF3029' }}>{fmt(Number(e.amount))} F</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => navigate(`/charge-achat/fixed-expenses/${e.id}/edit`)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Modifier">
                        <Edit2 className="w-3.5 h-3.5" style={{ color: '#1D6FA4' }} />
                      </button>
                      <button onClick={() => handleDelete(e.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {filtered.length} resultat{filtered.length > 1 ? 's' : ''} - Page {page + 1}/{pageCount}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                className="p-1.5 rounded-lg disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
