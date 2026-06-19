import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Filter, CreditCard as Edit2, Trash2, ChevronLeft, ChevronRight, Download, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import type { VehicleExpense, ExpenseCategory } from '@/types/chargeAchat.types'
import { buildCompanyGroups, resolveCompanyIds } from '@/utils/companyGroups'

const PAGE_SIZE = 20
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

interface Company { id: string; name: string; code: string; parent_id?: string | null; is_group?: boolean }

export default function ExpensesList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [expenses,    setExpenses]    = useState<VehicleExpense[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  const [search,      setSearch]      = useState('')
  const [company,     setCompany]     = useState(searchParams.get('company') ?? '')
  const [vehicle,     setVehicle]     = useState('')
  const [categoryId,  setCategoryId]  = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [amtMin,      setAmtMin]      = useState('')
  const [amtMax,      setAmtMax]      = useState('')
  const [sortField,   setSortField]   = useState<'expense_date' | 'amount'>('expense_date')
  const [sortDir,     setSortDir]     = useState<'desc' | 'asc'>('desc')

  const [companies,   setCompanies]   = useState<Company[]>([])
  const [categories,  setCategories]  = useState<ExpenseCategory[]>([])
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('companies').select('id,name,code,parent_id,is_group').order('name'),
      supabase.from('expense_categories').select('*').order('sort_order'),
    ]).then(([c, cat]) => {
      if (c.data) setCompanies(c.data)
      if (cat.data) setCategories(cat.data)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('vehicle_expenses')
        .select('*, company:companies(name,code), category:expense_categories(name,icon,color)', { count: 'exact' })
        .eq('source', 'charge_achat')

      if (company) {
        const ids = resolveCompanyIds(company, companies)
        if (ids.length === 1) q = q.eq('company_id', ids[0])
        else q = q.in('company_id', ids)
      }
      if (vehicle)    q = q.ilike('registration_number', `%${vehicle}%`)
      if (categoryId) q = q.eq('category_id', categoryId)
      if (dateFrom)   q = q.gte('expense_date', dateFrom)
      if (dateTo)     q = q.lte('expense_date', dateTo)
      if (amtMin)     q = q.gte('amount', Number(amtMin))
      if (amtMax)     q = q.lte('amount', Number(amtMax))
      if (search) {
        q = q.or(`description.ilike.%${search}%,registration_number.ilike.%${search}%,supplier.ilike.%${search}%`)
      }

      q = q.order(sortField, { ascending: sortDir === 'asc' })
      q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      const { data, count } = await q
      setExpenses((data ?? []) as VehicleExpense[])
      setTotal(count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [search, company, vehicle, categoryId, dateFrom, dateTo, amtMin, amtMax, sortField, sortDir, page])

  useEffect(() => { setPage(1) }, [search, company, vehicle, categoryId, dateFrom, dateTo, amtMin, amtMax])
  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return
    setDeleting(id)
    const { error } = await supabase.from('vehicle_expenses').delete().eq('id', id)
    if (error) { toast.error('Erreur lors de la suppression'); setDeleting(null); return }
    toast.success('Dépense supprimée')
    load()
    setDeleting(null)
  }

  const exportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    // Fetch ALL filtered data (no pagination)
    let q = supabase
      .from('vehicle_expenses')
      .select('*, company:companies(name,code), category:expense_categories(name,icon,color)')
      .eq('source', 'charge_achat')
    if (company) {
      const ids = resolveCompanyIds(company, companies)
      if (ids.length === 1) q = q.eq('company_id', ids[0])
      else q = q.in('company_id', ids)
    }
    if (vehicle)    q = q.ilike('registration_number', `%${vehicle}%`)
    if (categoryId) q = q.eq('category_id', categoryId)
    if (dateFrom)   q = q.gte('expense_date', dateFrom)
    if (dateTo)     q = q.lte('expense_date', dateTo)
    if (amtMin)     q = q.gte('amount', Number(amtMin))
    if (amtMax)     q = q.lte('amount', Number(amtMax))
    if (search)     q = q.or(`description.ilike.%${search}%,registration_number.ilike.%${search}%,supplier.ilike.%${search}%`)
    q = q.order('company_id').order('expense_date')

    const { data } = await q
    const all = (data ?? []) as VehicleExpense[]

    const wb = utils.book_new()

    // Group by company
    const byCompany: Record<string, VehicleExpense[]> = {}
    for (const e of all) {
      const code = e.company?.code ?? 'DIVERS'
      if (!byCompany[code]) byCompany[code] = []
      byCompany[code].push(e)
    }

    // One sheet per company
    for (const [code, rows] of Object.entries(byCompany)) {
      const fromDate = dateFrom || rows[0]?.expense_date || ''
      const toDate   = dateTo   || rows[rows.length - 1]?.expense_date || ''
      const sheetData: unknown[][] = [
        [`DÉPENSES DU ${fromDate} AU ${toDate}`],
        [],
        ['Date', 'Immatriculation', 'Catégorie', 'Description', 'Fournisseur', 'Montant (XOF)'],
        ...rows.map(r => [
          r.expense_date,
          r.registration_number,
          r.category?.name ?? '',
          r.description,
          r.supplier ?? '',
          Number(r.amount),
        ]),
        [],
        ['', '', '', '', 'TOTAL', rows.reduce((a, b) => a + Number(b.amount), 0)],
      ]
      const ws = utils.aoa_to_sheet(sheetData)
      utils.book_append_sheet(wb, ws, code)
    }

    // Récapitulatif sheet
    const recap: unknown[][] = [
      ['RÉCAPITULATIF'],
      [],
      ['Société', 'Total (XOF)'],
      ...Object.entries(byCompany).map(([code, rows]) => [code, rows.reduce((a, b) => a + Number(b.amount), 0)]),
      [],
      ['TOTAL GÉNÉRAL', all.reduce((a, b) => a + Number(b.amount), 0)],
    ]
    utils.book_append_sheet(wb, utils.aoa_to_sheet(recap), 'RÉCAPITULATIF')

    writeFile(wb, `depenses_vehicules_${format(new Date(), 'yyyy-MM-dd')}.xlsx`)
  }

  const pages = Math.ceil(total / PAGE_SIZE)
  const totalAmt = expenses.reduce((a, b) => a + Number(b.amount), 0)

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Dépenses véhicules</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{total} dépenses trouvées</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: '#1D6FA4', color: '#fff' }}
          >
            <Download className="w-3.5 h-3.5" /> Excel
          </button>
          <button
            onClick={() => navigate('/charge-achat/expenses/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#0B7439', color: '#fff' }}
          >
            <Plus className="w-4 h-4" /> Nouvelle dépense
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par description, immatriculation, fournisseur…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <button
            onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: showFilters ? '#0B7439' : 'var(--bg-subtle)', color: showFilters ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <Filter className="w-3.5 h-3.5" /> Filtres
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            {/* Société */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Société</label>
              <div className="relative">
                <select value={company} onChange={e => setCompany(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs appearance-none" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">Toutes</option>
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
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            {/* Véhicule */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Immatriculation</label>
              <input value={vehicle} onChange={e => setVehicle(e.target.value)} placeholder="Filtrer…" className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {/* Catégorie */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Catégorie</label>
              <div className="relative">
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs appearance-none" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                  <option value="">Toutes</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
            {/* Date from */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Date début</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {/* Date to */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Date fin</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            {/* Montant min/max */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Montant min</label>
              <input type="number" value={amtMin} onChange={e => setAmtMin(e.target.value)} placeholder="0" className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>Montant max</label>
              <input type="number" value={amtMax} onChange={e => setAmtMax(e.target.value)} placeholder="∞" className="w-full px-2.5 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { setCompany(''); setVehicle(''); setCategoryId(''); setDateFrom(''); setDateTo(''); setAmtMin(''); setAmtMax(''); setSearch('') }}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ color: '#DC2626', backgroundColor: '#fee2e2', border: '1px solid #fca5a5' }}
              >
                Réinitialiser
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                {['Date', 'Société', 'Véhicule', 'Catégorie', 'Description', 'Fournisseur', 'Montant'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
                <th className="px-3 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Chargement…</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aucune dépense trouvée</td></tr>
              ) : expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {format(new Date(e.expense_date), 'dd/MM/yy', { locale: fr })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: '#d4edda', color: '#0B7439' }}>
                      {e.company?.code ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    {e.registration_number}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {e.category ? (
                      <span className="flex items-center gap-1">
                        <span>{e.category.icon}</span>
                        <span style={{ color: e.category.color }}>{e.category.name}</span>
                      </span>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-3 py-2.5 max-w-[200px]">
                    <p className="truncate text-xs" style={{ color: 'var(--text-primary)' }}>{e.description}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{e.supplier ?? '—'}</td>
                  <td className="px-3 py-2.5 font-bold text-xs" style={{ color: Number(e.amount) >= 200000 ? '#DC2626' : 'var(--text-primary)' }}>
                    {fmt(Number(e.amount))}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/charge-achat/expenses/${e.id}/edit`)}
                        className="p-1.5 rounded hover:bg-gray-100"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </button>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting === e.id}
                        className="p-1.5 rounded hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" style={{ color: deleting === e.id ? '#D1D5DB' : '#DC2626' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <td colSpan={6} className="px-3 py-2.5 text-right text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Total page ({expenses.length} lignes) :
                  </td>
                  <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#0B7439' }}>{fmt(totalAmt)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Page {page} / {pages} — {total} résultats
            </p>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded disabled:opacity-40 hover:bg-gray-100">
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded disabled:opacity-40 hover:bg-gray-100">
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
