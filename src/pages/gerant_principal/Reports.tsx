import { useEffect, useState } from 'react'
import { FileText, Download, Calendar, ArrowDownCircle, ArrowUpCircle, Building2, Bus, Package, CircleDot, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchEntries, fetchExits, fetchArticles, fetchTires, fetchCompanies } from '@/services/stock.service'
import type { StockEntry, StockExit, StockArticle, StockTire, CompanyOption } from '@/types/stock.types'

function fmt(n: number) { return new Intl.NumberFormat('fr-FR').format(Math.round(n)) }

function exportCSV(filename: string, rows: string[][], headers: string[]) {
  const content = [headers, ...rows].map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

type ReportType = 'entries' | 'exits' | 'by_company' | 'by_bus' | 'by_article' | 'tires_brand' | 'monthly' | 'custom'

const REPORT_TYPES: { value: ReportType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
  { value: 'entries', label: 'Entrées de stock', icon: ArrowDownCircle, color: '#1D6FA4' },
  { value: 'exits', label: 'Sorties de stock', icon: ArrowUpCircle, color: '#AF3029' },
  { value: 'by_company', label: 'Par société', icon: Building2, color: '#0B7439' },
  { value: 'by_bus', label: 'Par bus', icon: Bus, color: '#D97706' },
  { value: 'by_article', label: 'Par article', icon: Package, color: '#1D6FA4' },
  { value: 'tires_brand', label: 'Pneus par marque', icon: CircleDot, color: '#D97706' },
  { value: 'monthly', label: 'Rapport mensuel', icon: Calendar, color: '#0B7439' },
  { value: 'custom', label: 'Période personnalisée', icon: BarChart2, color: '#6B7280' },
]

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('entries')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [exits, setExits] = useState<StockExit[]>([])
  const [articles, setArticles] = useState<StockArticle[]>([])
  const [tires, setTires] = useState<StockTire[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = () => {
    setLoading(true)
    Promise.all([
      fetchEntries({ date_from: dateFrom, date_to: dateTo }),
      fetchExits({ date_from: dateFrom, date_to: dateTo }),
      fetchArticles(),
      fetchTires(),
      fetchCompanies(),
    ])
      .then(([en, ex, art, ti, co]) => {
        setEntries(en); setExits(ex); setArticles(art); setTires(ti); setCompanies(co)
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [dateFrom, dateTo])

  const handleExport = () => {
    switch (reportType) {
      case 'entries': {
        exportCSV('rapport_entrees', entries.map(e => [
          new Date(e.entry_date).toLocaleDateString('fr-FR'),
          e.article?.designation ?? '', e.article?.brand ?? '', e.article?.reference ?? '',
          String(e.quantity), String(e.unit_price), String(e.total_amount ?? 0),
          e.supplier, e.invoice_number,
        ]), ['Date', 'Article', 'Marque', 'Réf.', 'Qté', 'Prix unit.', 'Total', 'Fournisseur', 'N° Facture'])
        break
      }
      case 'exits': {
        exportCSV('rapport_sorties', exits.map(e => [
          new Date(e.exit_date).toLocaleDateString('fr-FR'),
          e.article?.designation ?? '', e.article?.brand ?? '',
          String(e.quantity), String(e.unit_price), String(e.total_amount ?? 0),
          e.company?.name ?? '', e.company?.code ?? '',
          e.bus?.registration_number ?? '', e.exit_reason, e.requester_name, e.validator_name,
        ]), ['Date', 'Article', 'Marque', 'Qté', 'Prix unit.', 'Total', 'Société', 'Code', 'Bus', 'Motif', 'Demandeur', 'Validateur'])
        break
      }
      case 'by_company': {
        const grouped = new Map<string, { name: string; code: string; qty: number; val: number }>()
        exits.forEach(e => {
          const key = e.company?.id ?? 'none'
          const cur = grouped.get(key) ?? { name: e.company?.name ?? 'Sans société', code: e.company?.code ?? '', qty: 0, val: 0 }
          cur.qty += e.quantity; cur.val += Number(e.total_amount ?? 0)
          grouped.set(key, cur)
        })
        exportCSV('rapport_par_societe', [...grouped.values()].map(c => [c.name, c.code, String(c.qty), String(c.val)]),
          ['Société', 'Code', 'Qté sorties', 'Valeur FCFA'])
        break
      }
      case 'by_bus': {
        const grouped = new Map<string, { reg: string; qty: number; val: number }>()
        exits.forEach(e => {
          if (!e.bus_id) return
          const key = e.bus_id
          const cur = grouped.get(key) ?? { reg: e.bus?.registration_number ?? '', qty: 0, val: 0 }
          cur.qty += e.quantity; cur.val += Number(e.total_amount ?? 0)
          grouped.set(key, cur)
        })
        exportCSV('rapport_par_bus', [...grouped.values()].map(b => [b.reg, String(b.qty), String(b.val)]),
          ['Bus', 'Qté sorties', 'Valeur FCFA'])
        break
      }
      case 'by_article': {
        exportCSV('rapport_par_article', articles.map(a => {
          const stock = a.computed_stock ?? 0
          const price = Number(a.last_entry_price ?? a.unit_price)
          const totalExitVal = exits.filter(e => e.article_id === a.id).reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
          return [
            a.designation, a.brand, a.reference,
            String(a.total_entries ?? 0), String(a.total_exits ?? 0), String(stock),
            String(price), String(stock * price), String(totalExitVal),
          ]
        }), ['Article', 'Marque', 'Réf.', 'Qté entrée', 'Qté sortie', 'Stock restant', 'Prix unit.', 'Valeur stock', 'Montant total sorties'])
        break
      }
      case 'tires_brand': {
        const grouped = new Map<string, { brand: string; total: number; en_stock: number; monte: number; use: number; reforme: number }>()
        tires.forEach(t => {
          const cur = grouped.get(t.brand) ?? { brand: t.brand, total: 0, en_stock: 0, monte: 0, use: 0, reforme: 0 }
          cur.total++
          if (t.status === 'en_stock') cur.en_stock++
          else if (t.status === 'monte') cur.monte++
          else if (t.status === 'use') cur.use++
          else if (t.status === 'reforme') cur.reforme++
          grouped.set(t.brand, cur)
        })
        exportCSV('rapport_pneus_marque', [...grouped.values()].map(b => [
          b.brand, String(b.total), String(b.en_stock), String(b.monte), String(b.use), String(b.reforme),
        ]), ['Marque', 'Total', 'En stock', 'Montés', 'Usés', 'Réformés'])
        break
      }
      case 'monthly':
      case 'custom': {
        const totalEntVal = entries.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
        const totalExitVal = exits.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
        exportCSV('rapport_synthese', [
          ['Nombre entrées', String(entries.length), String(entries.reduce((s, e) => s + e.quantity, 0)), String(totalEntVal)],
          ['Nombre sorties', String(exits.length), String(exits.reduce((s, e) => s + e.quantity, 0)), String(totalExitVal)],
          ['Solde net', '', '', String(totalEntVal - totalExitVal)],
        ], ['Type', 'Nb opérations', 'Qté totale', 'Valeur FCFA'])
        break
      }
    }
    toast.success('Export CSV généré')
  }

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }

    switch (reportType) {
      case 'entries':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#E3F0F9] rounded-xl p-4">
              <div>
                <p className="text-sm text-[#1D6FA4]">Total entrées: <strong>{entries.length}</strong></p>
                <p className="text-xs text-[#6B7280]">{entries.reduce((s, e) => s + e.quantity, 0)} unités</p>
              </div>
              <p className="text-lg font-bold text-[#1D6FA4]">{fmt(entries.reduce((s, e) => s + Number(e.total_amount ?? 0), 0))} F</p>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#F8FAF8]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#4A6B55]">Date</th>
                    <th className="text-left px-3 py-2 text-[#4A6B55]">Article</th>
                    <th className="text-right px-3 py-2 text-[#4A6B55]">Qté</th>
                    <th className="text-right px-3 py-2 text-[#4A6B55]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 20).map(e => (
                    <tr key={e.id} className="border-t border-[#E2EAE5]">
                      <td className="px-3 py-1.5">{new Date(e.entry_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-1.5">{e.article?.designation}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-[#0B7439]">+{e.quantity}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(Number(e.total_amount ?? 0))} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'exits':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#FEF2F2] rounded-xl p-4">
              <div>
                <p className="text-sm text-[#AF3029]">Total sorties: <strong>{exits.length}</strong></p>
                <p className="text-xs text-[#6B7280]">{exits.reduce((s, e) => s + e.quantity, 0)} unités</p>
              </div>
              <p className="text-lg font-bold text-[#AF3029]">{fmt(exits.reduce((s, e) => s + Number(e.total_amount ?? 0), 0))} F</p>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#F8FAF8]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[#4A6B55]">Date</th>
                    <th className="text-left px-3 py-2 text-[#4A6B55]">Article</th>
                    <th className="text-left px-3 py-2 text-[#4A6B55]">Société</th>
                    <th className="text-right px-3 py-2 text-[#4A6B55]">Qté</th>
                    <th className="text-right px-3 py-2 text-[#4A6B55]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {exits.slice(0, 20).map(e => (
                    <tr key={e.id} className="border-t border-[#E2EAE5]">
                      <td className="px-3 py-1.5">{new Date(e.exit_date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-1.5">{e.article?.designation}</td>
                      <td className="px-3 py-1.5">{e.company?.name ?? '—'}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-[#AF3029]">-{e.quantity}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(Number(e.total_amount ?? 0))} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'by_company': {
        const grouped = new Map<string, { name: string; code: string; qty: number; val: number }>()
        exits.forEach(e => {
          const key = e.company?.id ?? 'none'
          const cur = grouped.get(key) ?? { name: e.company?.name ?? 'Sans société', code: e.company?.code ?? '', qty: 0, val: 0 }
          cur.qty += e.quantity; cur.val += Number(e.total_amount ?? 0)
          grouped.set(key, cur)
        })
        const rows = [...grouped.values()].sort((a, b) => b.val - a.val)
        return (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <div>
                  <p className="text-sm font-medium text-[#1A2E22]">{r.name}</p>
                  <p className="text-xs text-[#6B7280]">{r.code} - {r.qty} pièces sorties</p>
                </div>
                <p className="font-bold text-[#AF3029]">{fmt(r.val)} F</p>
              </div>
            ))}
            {rows.length === 0 && <p className="text-center text-[#8AA898] py-8 text-sm">Aucune donnée</p>}
          </div>
        )
      }
      case 'by_bus': {
        const grouped = new Map<string, { reg: string; qty: number; val: number }>()
        exits.forEach(e => {
          if (!e.bus_id) return
          const cur = grouped.get(e.bus_id) ?? { reg: e.bus?.registration_number ?? '', qty: 0, val: 0 }
          cur.qty += e.quantity; cur.val += Number(e.total_amount ?? 0)
          grouped.set(e.bus_id, cur)
        })
        const rows = [...grouped.values()].sort((a, b) => b.val - a.val)
        return (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <div>
                  <p className="text-sm font-medium font-mono text-[#0B7439]">{r.reg}</p>
                  <p className="text-xs text-[#6B7280]">{r.qty} pièces utilisées</p>
                </div>
                <p className="font-bold text-[#AF3029]">{fmt(r.val)} F</p>
              </div>
            ))}
            {rows.length === 0 && <p className="text-center text-[#8AA898] py-8 text-sm">Aucune donnée</p>}
          </div>
        )
      }
      case 'by_article': {
        const sorted = [...articles].sort((a, b) => {
          const valB = (b.computed_stock ?? 0) * Number(b.last_entry_price ?? b.unit_price)
          const valA = (a.computed_stock ?? 0) * Number(a.last_entry_price ?? a.unit_price)
          return valB - valA
        })
        return (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#F8FAF8]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#4A6B55]">Article</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Qté entrée</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Qté sortie</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Stock restant</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Prix unit.</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Valeur stock</th>
                  <th className="text-right px-3 py-2 text-[#4A6B55]">Total sorties</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 20).map(a => {
                  const stock = a.computed_stock ?? 0
                  const price = Number(a.last_entry_price ?? a.unit_price)
                  const totalExitVal = exits.filter(e => e.article_id === a.id).reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
                  return (
                    <tr key={a.id} className="border-t border-[#E2EAE5]">
                      <td className="px-3 py-1.5">
                        <p className="font-medium text-[#1A2E22]">{a.designation}</p>
                        <p className="text-[10px] text-[#6B7280]">{a.brand}</p>
                      </td>
                      <td className="px-3 py-1.5 text-right text-[#1D6FA4] font-medium">{a.total_entries ?? 0}</td>
                      <td className="px-3 py-1.5 text-right text-[#AF3029] font-medium">{a.total_exits ?? 0}</td>
                      <td className={`px-3 py-1.5 text-right font-bold ${stock <= 0 ? 'text-[#DC2626]' : stock <= a.alert_threshold ? 'text-[#D97706]' : 'text-[#0B7439]'}`}>
                        {stock}
                      </td>
                      <td className="px-3 py-1.5 text-right">{fmt(price)} F</td>
                      <td className="px-3 py-1.5 text-right font-medium text-[#0B7439]">{fmt(stock * price)} F</td>
                      <td className="px-3 py-1.5 text-right font-medium text-[#AF3029]">{fmt(totalExitVal)} F</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      }
      case 'tires_brand': {
        const grouped = new Map<string, { total: number; en_stock: number; monte: number; use: number; reforme: number }>()
        tires.forEach(t => {
          const cur = grouped.get(t.brand) ?? { total: 0, en_stock: 0, monte: 0, use: 0, reforme: 0 }
          cur.total++
          if (t.status === 'en_stock') cur.en_stock++
          else if (t.status === 'monte') cur.monte++
          else if (t.status === 'use') cur.use++
          else cur.reforme++
          grouped.set(t.brand, cur)
        })
        return (
          <div className="space-y-2">
            {[...grouped.entries()].sort((a, b) => b[1].total - a[1].total).map(([brand, d]) => (
              <div key={brand} className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold text-[#1A2E22]">{brand}</p>
                  <p className="text-sm font-bold text-[#D97706]">{d.total} pneus</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="px-2 py-0.5 rounded bg-[#E8F5EC] text-[#0B7439]">Stock: {d.en_stock}</span>
                  <span className="px-2 py-0.5 rounded bg-[#E3F0F9] text-[#1D6FA4]">Montés: {d.monte}</span>
                  <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#D97706]">Usés: {d.use}</span>
                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#AF3029]">Réformés: {d.reforme}</span>
                </div>
              </div>
            ))}
            {grouped.size === 0 && <p className="text-center text-[#8AA898] py-8 text-sm">Aucun pneu</p>}
          </div>
        )
      }
      case 'monthly':
      case 'custom': {
        const totalEntVal = entries.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
        const totalExitVal = exits.reduce((s, e) => s + Number(e.total_amount ?? 0), 0)
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-[#E3F0F9] text-center">
                <p className="text-lg font-bold text-[#1D6FA4]">{fmt(totalEntVal)} F</p>
                <p className="text-xs text-[#1D6FA4]">Entrées</p>
              </div>
              <div className="p-4 rounded-xl bg-[#FEF2F2] text-center">
                <p className="text-lg font-bold text-[#AF3029]">{fmt(totalExitVal)} F</p>
                <p className="text-xs text-[#AF3029]">Sorties</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ backgroundColor: totalEntVal >= totalExitVal ? '#E8F5EC' : '#FEF2F2' }}>
                <p className="text-lg font-bold" style={{ color: totalEntVal >= totalExitVal ? '#0B7439' : '#AF3029' }}>
                  {fmt(totalEntVal - totalExitVal)} F
                </p>
                <p className="text-xs" style={{ color: totalEntVal >= totalExitVal ? '#0B7439' : '#AF3029' }}>Solde net</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <p className="text-[#6B7280]">Nb entrées</p>
                <p className="font-bold text-[#1A2E22]">{entries.length} ({entries.reduce((s, e) => s + e.quantity, 0)} unités)</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <p className="text-[#6B7280]">Nb sorties</p>
                <p className="font-bold text-[#1A2E22]">{exits.length} ({exits.reduce((s, e) => s + e.quantity, 0)} unités)</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <p className="text-[#6B7280]">Articles en stock</p>
                <p className="font-bold text-[#1A2E22]">{articles.length}</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                <p className="text-[#6B7280]">Pneus enregistrés</p>
                <p className="font-bold text-[#1A2E22]">{tires.length}</p>
              </div>
            </div>
          </div>
        )
      }
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E22]">Rapports Stock</h1>
        <p className="text-sm text-[#6B7280] mt-1">Exports et analyses du stock</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {REPORT_TYPES.map(rt => (
          <button key={rt.value} onClick={() => setReportType(rt.value)}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
              reportType === rt.value ? 'ring-2 shadow-md bg-white' : 'bg-white hover:shadow-sm'
            }`}
            style={{ borderColor: reportType === rt.value ? rt.color : '#E2EAE5', ...(reportType === rt.value ? { ringColor: rt.color } : {}) }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: rt.color + '18' }}>
              <rt.icon className="w-4 h-4" style={{ color: rt.color }} />
            </div>
            <span className="text-sm font-medium text-[#1A2E22]">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Date filters + export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-2xl border border-[#E2EAE5] p-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-[#8AA898]" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E2EAE5] text-sm" />
          <span className="text-[#8AA898]">au</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E2EAE5] text-sm" />
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#0B7439] text-white rounded-xl font-medium hover:bg-[#095e2e] transition-colors">
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-6">
        <h3 className="font-bold text-[#1A2E22] mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4A6B55]" />
          {REPORT_TYPES.find(r => r.value === reportType)?.label}
        </h3>
        {renderPreview()}
      </div>
    </div>
  )
}
