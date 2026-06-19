import { useEffect, useState, useRef } from 'react'
import { ArrowUpCircle, Plus, Search, X, Calendar, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchExits, createExit, fetchArticles, fetchCompanies, fetchBuses } from '@/services/stock.service'
import type { StockExit, StockArticle, CompanyOption, BusOption } from '@/types/stock.types'

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

export default function StockExits() {
  const [exits, setExits] = useState<StockExit[]>([])
  const [articles, setArticles] = useState<StockArticle[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [buses, setBuses] = useState<BusOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [articleSearch, setArticleSearch] = useState('')
  const [showArticleDropdown, setShowArticleDropdown] = useState(false)
  const articleDropdownRef = useRef<HTMLDivElement>(null)

  const [busSearch, setBusSearch] = useState('')
  const [showBusDropdown, setShowBusDropdown] = useState(false)
  const busDropdownRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    article_id: '',
    exit_date: new Date().toISOString().slice(0, 10),
    quantity: 1,
    unit_price: 0,
    company_id: '' as string,
    group_id: '' as string,
    bus_id: '' as string,
    exit_reason: '',
  })

  const load = () => {
    setLoading(true)
    Promise.all([
      fetchExits({ date_from: dateFrom || null, date_to: dateTo || null }),
      fetchArticles(),
      fetchCompanies(),
      fetchBuses(),
    ])
      .then(([ex, art, comp, bus]) => {
        setExits(ex); setArticles(art); setCompanies(comp); setBuses(bus)
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dateFrom, dateTo])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (articleDropdownRef.current && !articleDropdownRef.current.contains(e.target as Node)) {
        setShowArticleDropdown(false)
      }
      if (busDropdownRef.current && !busDropdownRef.current.contains(e.target as Node)) {
        setShowBusDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = search
    ? exits.filter(e =>
        (e.article?.designation ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.company?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.bus?.registration_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
        e.requester_name.toLowerCase().includes(search.toLowerCase())
      )
    : exits

  const totalQty = filtered.reduce((s, e) => s + e.quantity, 0)
  const totalVal = filtered.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)

  const selectedArticle = articles.find(a => a.id === form.article_id)

  const articleResults = articleSearch.trim().length > 0
    ? articles.filter(a => {
        const s = articleSearch.toLowerCase()
        return a.designation.toLowerCase().includes(s) ||
          a.reference.toLowerCase().includes(s) ||
          a.brand.toLowerCase().includes(s) ||
          a.category.toLowerCase().includes(s)
      }).slice(0, 10)
    : articles.slice(0, 10)

  const getCompanyName = (companyId: string) => companies.find(c => c.id === companyId)?.name ?? ''
  const getGroupName = (companyId: string) => {
    const comp = companies.find(c => c.id === companyId)
    if (!comp) return ''
    if (comp.is_group) return comp.name
    const group = companies.find(c => c.id === comp.parent_id)
    return group?.name ?? ''
  }
  const busResults = busSearch.trim().length > 0
    ? buses.filter(b => {
        const s = busSearch.toLowerCase()
        const compName = getCompanyName(b.company_id).toLowerCase()
        const groupName = getGroupName(b.company_id).toLowerCase()
        return b.registration_number.toLowerCase().includes(s) ||
          `${b.brand} ${b.model}`.toLowerCase().includes(s) ||
          compName.includes(s) ||
          groupName.includes(s)
      }).slice(0, 10)
    : buses.slice(0, 10)

  const handleArticleSelect = (article: StockArticle) => {
    setForm(prev => ({ ...prev, article_id: article.id, unit_price: Number(article.unit_price) }))
    setArticleSearch(article.designation)
    setShowArticleDropdown(false)
  }

  const handleBusSelect = (bus: BusOption) => {
    const comp = companies.find(c => c.id === bus.company_id)
    const groupId = comp?.parent_id ?? (comp?.is_group ? comp.id : '')
    setForm(prev => ({
      ...prev,
      bus_id: bus.id,
      company_id: bus.company_id ?? '',
      group_id: groupId,
    }))
    setBusSearch(`${bus.registration_number} - ${bus.brand} ${bus.model}`)
    setShowBusDropdown(false)
  }

  const clearArticle = () => {
    setForm(prev => ({ ...prev, article_id: '', unit_price: 0 }))
    setArticleSearch('')
  }

  const clearBus = () => {
    setForm(prev => ({ ...prev, bus_id: '', company_id: '', group_id: '' }))
    setBusSearch('')
  }

  const stockInsufficient = selectedArticle && form.quantity > (selectedArticle.computed_stock ?? 0)

  const handleSave = async () => {
    if (!form.article_id) { toast.error('Sélectionnez un article'); return }
    if (form.quantity <= 0) { toast.error('La quantité doit être supérieure à 0'); return }
    if (selectedArticle && form.quantity > (selectedArticle.computed_stock ?? 0)) {
      toast.error(`Stock insuffisant. Disponible: ${(selectedArticle.computed_stock ?? 0)}`)
      return
    }
    setSaving(true)
    try {
      await createExit({
        article_id: form.article_id,
        exit_date: form.exit_date,
        quantity: form.quantity,
        unit_price: form.unit_price,
        company_id: form.company_id || null,
        group_id: form.group_id || null,
        bus_id: form.bus_id || null,
        exit_reason: form.exit_reason,
      })
      toast.success('Sortie enregistrée')
      setShowModal(false)
      setForm({ article_id: '', exit_date: new Date().toISOString().slice(0, 10), quantity: 1, unit_price: 0, company_id: '', group_id: '', bus_id: '', exit_reason: '' })
      setArticleSearch('')
      setBusSearch('')
      load()
    } catch (err: any) {
      toast.error(err.message?.includes('stock') ? 'Stock insuffisant' : err.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const selectedBus = buses.find(b => b.id === form.bus_id)
  const selectedCompany = form.company_id ? companies.find(c => c.id === form.company_id) : null
  const selectedGroup = form.group_id ? companies.find(c => c.id === form.group_id) : null

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Sorties de stock</h1>
          <p className="text-sm text-[#6B7280] mt-1">{filtered.length} sortie(s) -- Total: {fmt(totalQty)} unités, {fmt(totalVal)} FCFA</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#D97706] text-white rounded-xl font-medium hover:bg-[#b86505] transition-colors">
          <Plus className="w-4 h-4" /> Nouvelle sortie
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher article, société, bus, demandeur..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E2EAE5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 focus:border-[#D97706]" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#8AA898]" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm" />
          <span className="text-[#8AA898]">-</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-[#D97706] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] border-b border-[#E2EAE5]">
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Article</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Bénéficiaire</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Bus</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#4A6B55]">Motif</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Qté</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#4A6B55]">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-[#8AA898]">Aucune sortie trouvée</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="border-t border-[#E2EAE5] hover:bg-[#F8FAF8] transition-colors">
                    <td className="px-4 py-3 text-[#1A2E22] font-medium">
                      {new Date(e.exit_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1A2E22]">{e.article?.designation ?? '—'}</p>
                      <p className="text-xs text-[#6B7280]">{e.article?.brand}</p>
                    </td>
                    <td className="px-4 py-3 text-[#4A6B55]">
                      {e.company?.name ?? e.group?.name ?? e.garage?.name ?? '—'}
                      {e.company?.code && <span className="text-xs text-[#8AA898] ml-1">({e.company.code})</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#0B7439]">
                      {e.bus?.registration_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-[#4A6B55] text-xs max-w-[150px] truncate">{e.exit_reason || '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#AF3029]">-{e.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#AF3029]">{fmt(Number(e.total_amount))} F</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-[#FEF2F2] border-t-2 border-[#AF3029]">
                    <td colSpan={5} className="px-4 py-3 font-bold text-[#AF3029]">TOTAL SORTIES</td>
                    <td className="px-4 py-3 text-right font-bold text-[#AF3029]">{fmt(totalQty)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#AF3029]">{fmt(totalVal)} F</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#E2EAE5]">
              <h2 className="text-lg font-bold text-[#1A2E22] flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-[#D97706]" /> Nouvelle sortie
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-[#F4F7F5]">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* Article autocomplete */}
              <div ref={articleDropdownRef} className="relative">
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Article *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
                  <input
                    value={articleSearch}
                    onChange={e => {
                      setArticleSearch(e.target.value)
                      setShowArticleDropdown(true)
                      if (form.article_id) {
                        setForm(prev => ({ ...prev, article_id: '', unit_price: 0 }))
                      }
                    }}
                    onFocus={() => setShowArticleDropdown(true)}
                    placeholder="Rechercher par nom, référence, marque, catégorie..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 focus:border-[#D97706]"
                  />
                  {form.article_id && (
                    <button onClick={clearArticle} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[#F4F7F5]">
                      <X className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  )}
                </div>

                {showArticleDropdown && !form.article_id && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#E2EAE5] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {articleResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[#8AA898]">Aucun article trouvé</div>
                    ) : articleResults.map(a => {
                      const isLow = (a.computed_stock ?? 0) <= a.alert_threshold
                      const isZero = (a.computed_stock ?? 0) === 0
                      return (
                        <button
                          key={a.id}
                          onClick={() => handleArticleSelect(a)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAF8] transition-colors border-b border-[#E2EAE5] last:border-b-0 flex items-start gap-3"
                        >
                          <Package className="w-4 h-4 mt-0.5 text-[#8AA898] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm text-[#1A2E22] truncate">{a.designation}</span>
                              <span className={`text-xs font-bold shrink-0 px-2 py-0.5 rounded-full ${
                                isZero ? 'bg-[#FEE2E2] text-[#AF3029]' : isLow ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#D1FAE5] text-[#0B7439]'
                              }`}>
                                {(a.computed_stock ?? 0)} en stock
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {a.brand && <span className="text-xs text-[#6B7280]">{a.brand}</span>}
                              {a.reference && <span className="text-xs text-[#8AA898]">Réf: {a.reference}</span>}
                              {a.category && <span className="text-xs text-[#8AA898]">- {a.category}</span>}
                            </div>
                            <div className="text-xs text-[#6B7280] mt-0.5">{fmt(Number(a.unit_price))} FCFA / unité</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedArticle && (
                  <div className={`mt-2 rounded-xl p-3 flex items-start gap-3 ${
                    (selectedArticle.computed_stock ?? 0) <= selectedArticle.alert_threshold
                      ? 'bg-[#FEF3C7] border border-[#F59E0B]'
                      : 'bg-[#F0FDF4] border border-[#86EFAC]'
                  }`}>
                    <Package className="w-5 h-5 mt-0.5 shrink-0 text-[#4A6B55]" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1A2E22]">{selectedArticle.designation}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {selectedArticle.brand && <span className="text-xs text-[#4A6B55]">Marque: {selectedArticle.brand}</span>}
                        {selectedArticle.reference && <span className="text-xs text-[#4A6B55]">Réf: {selectedArticle.reference}</span>}
                        <span className="text-xs text-[#4A6B55]">Prix: {fmt(Number(selectedArticle.unit_price))} FCFA</span>
                        <span className={`text-xs font-bold ${
                          (selectedArticle.computed_stock ?? 0) <= selectedArticle.alert_threshold ? 'text-[#AF3029]' : 'text-[#0B7439]'
                        }`}>
                          Stock: {(selectedArticle.computed_stock ?? 0)}
                        </span>
                      </div>
                      {(selectedArticle.computed_stock ?? 0) <= selectedArticle.alert_threshold && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                          <span className="text-xs font-medium text-[#D97706]">Stock faible (seuil: {selectedArticle.alert_threshold})</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Date *</label>
                  <input type="date" value={form.exit_date} onChange={e => setForm({ ...form, exit_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Quantité *</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                      stockInsufficient
                        ? 'border-[#AF3029] focus:ring-[#AF3029]/20 bg-[#FEF2F2]'
                        : 'border-[#E2EAE5] focus:ring-[#D97706]/20'
                    }`} />
                  {stockInsufficient && (
                    <p className="text-xs mt-1 text-[#AF3029] font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Stock insuffisant (disponible: {(selectedArticle.computed_stock ?? 0)})
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#4A6B55] mb-1">Prix unitaire (FCFA)</label>
                  <input type="number" min={0} value={form.unit_price} onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20" />
                </div>
              </div>

              {/* Bus autocomplete */}
              <div ref={busDropdownRef} className="relative">
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Bus</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8AA898]" />
                  <input
                    value={busSearch}
                    onChange={e => {
                      setBusSearch(e.target.value)
                      setShowBusDropdown(true)
                      if (form.bus_id) {
                        setForm(prev => ({ ...prev, bus_id: '', company_id: '', group_id: '' }))
                      }
                    }}
                    onFocus={() => setShowBusDropdown(true)}
                    placeholder="Rechercher par immatriculation, société, groupe..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20 focus:border-[#D97706]"
                  />
                  {form.bus_id && (
                    <button onClick={clearBus} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[#F4F7F5]">
                      <X className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  )}
                </div>

                {showBusDropdown && !form.bus_id && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-[#E2EAE5] rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {busResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[#8AA898]">Aucun bus trouvé</div>
                    ) : busResults.map(b => {
                      const compName = getCompanyName(b.company_id)
                      const grpName = getGroupName(b.company_id)
                      return (
                        <button
                          key={b.id}
                          onClick={() => handleBusSelect(b)}
                          className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAF8] transition-colors border-b border-[#E2EAE5] last:border-b-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-bold text-sm text-[#0B7439]">{b.registration_number}</span>
                            <span className="text-xs text-[#6B7280]">{b.brand} {b.model}</span>
                          </div>
                          {(compName || grpName) && (
                            <div className="flex items-center gap-2 mt-0.5">
                              {grpName && <span className="text-xs text-[#8AA898]">{grpName}</span>}
                              {grpName && compName && <span className="text-xs text-[#8AA898]">/</span>}
                              {compName && <span className="text-xs text-[#4A6B55]">{compName}</span>}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}

                {selectedBus && (
                  <div className="mt-2 rounded-xl p-3 bg-[#EFF6FF] border border-[#93C5FD] flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#1E40AF] font-mono">{selectedBus.registration_number}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-xs text-[#4A6B55]">{selectedBus.brand} {selectedBus.model}</span>
                        {selectedCompany && <span className="text-xs text-[#4A6B55]">Société: {selectedCompany.name}</span>}
                        {selectedGroup && <span className="text-xs text-[#4A6B55]">Groupe: {selectedGroup.name}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#4A6B55] mb-1">Motif de sortie</label>
                <input value={form.exit_reason} onChange={e => setForm({ ...form, exit_reason: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E2EAE5] text-sm focus:outline-none focus:ring-2 focus:ring-[#D97706]/20" />
              </div>
              {form.quantity > 0 && form.unit_price > 0 && (
                <div className="bg-[#FEF3C7] rounded-xl p-3 text-center">
                  <p className="text-sm text-[#D97706]">Total sortie: <strong>{fmt(form.quantity * form.unit_price)} FCFA</strong></p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-[#E2EAE5]">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl border border-[#E2EAE5] text-sm font-medium text-[#4A6B55] hover:bg-[#F8FAF8]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving || !!stockInsufficient}
                className="px-6 py-2.5 rounded-xl bg-[#D97706] text-white text-sm font-medium hover:bg-[#b86505] disabled:opacity-50 transition-colors">
                {saving ? 'Enregistrement...' : 'Enregistrer la sortie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
