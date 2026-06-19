import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Disc, DollarSign, ArrowDownCircle, ArrowUpCircle,
  AlertTriangle, BarChart2, Loader2, RefreshCw, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { fetchDashboardKPIs, fetchArticles } from '@/services/stock.service'
import type { StockDashboardKPIs, StockArticle } from '@/types/stock.types'

const fmt = (n: number) => new Intl.NumberFormat('fr-CI', { maximumFractionDigits: 0 }).format(n)

export default function GerantPrincipalDashboard() {
  const navigate = useNavigate()
  const [kpis, setKpis] = useState<StockDashboardKPIs | null>(null)
  const [lowStock, setLowStock] = useState<StockArticle[]>([])
  const [topArticles, setTopArticles] = useState<{ designation: string; total_qty: number }[]>([])
  const [topCompanies, setTopCompanies] = useState<{ name: string; total: number }[]>([])
  const [topBuses, setTopBuses] = useState<{ reg: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [k, articles, exitsRes] = await Promise.all([
        fetchDashboardKPIs(),
        fetchArticles(),
        supabase.from('gp_stock_exits').select(`
          quantity, total_amount, article_id,
          article:gp_stock_articles(designation),
          company:companies!gp_stock_exits_company_id_fkey(name),
          bus:buses!gp_stock_exits_bus_id_fkey(registration_number)
        `).gte('exit_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      ])
      setKpis(k)

      setLowStock(articles.filter(a => {
        const stock = a.computed_stock ?? 0
        return stock <= a.alert_threshold
      }).sort((a, b) => (a.computed_stock ?? 0) - (b.computed_stock ?? 0)).slice(0, 10))

      const exits = (exitsRes.data ?? []) as any[]
      const artMap = new Map<string, { designation: string; total_qty: number }>()
      const compMap = new Map<string, number>()
      const busMap = new Map<string, number>()

      for (const e of exits) {
        const des = e.article?.designation ?? 'Inconnu'
        const prev = artMap.get(des)
        artMap.set(des, { designation: des, total_qty: (prev?.total_qty ?? 0) + e.quantity })

        if (e.company?.name) {
          compMap.set(e.company.name, (compMap.get(e.company.name) ?? 0) + Number(e.total_amount))
        }
        if (e.bus?.registration_number) {
          busMap.set(e.bus.registration_number, (busMap.get(e.bus.registration_number) ?? 0) + Number(e.total_amount))
        }
      }

      setTopArticles([...artMap.values()].sort((a, b) => b.total_qty - a.total_qty).slice(0, 8))
      setTopCompanies([...compMap.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 6))
      setTopBuses([...busMap.entries()].map(([reg, total]) => ({ reg, total })).sort((a, b) => b.total - a.total).slice(0, 6))
    } catch {
      toast.error('Erreur chargement tableau de bord')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0B7439]" />
      </div>
    )
  }

  const kpiCards = [
    { label: 'Articles au catalogue', value: fmt(kpis?.total_articles ?? 0), icon: Package, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Stock total disponible', value: fmt(kpis?.total_stock ?? 0), icon: Disc, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Valeur totale du stock', value: `${fmt(kpis?.stock_value ?? 0)} F`, icon: DollarSign, color: '#0B7439', bg: '#F0FDF4' },
    { label: 'Entrees du mois', value: `${fmt(kpis?.entries_month_count ?? 0)} (${fmt(kpis?.entries_month_value ?? 0)} F)`, icon: ArrowDownCircle, color: '#0891B2', bg: '#ECFEFF' },
    { label: 'Sorties du mois', value: `${fmt(kpis?.exits_month_count ?? 0)} (${fmt(kpis?.exits_month_value ?? 0)} F)`, icon: ArrowUpCircle, color: '#DC2626', bg: '#FEF2F2' },
    { label: 'Stock faible', value: String(kpis?.low_stock_count ?? 0), icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
    { label: 'En rupture', value: String(kpis?.out_of_stock_count ?? 0), icon: XCircle, color: '#AF3029', bg: '#FEF2F2' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Stock Principal</h1>
          <p className="text-sm text-[#6B7C72] mt-1">Tableau de bord - Stock calcule a partir des mouvements reels</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E2EAE5] text-sm font-medium text-[#4A6B55] hover:bg-[#F4F7F5] transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {kpiCards.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                <k.icon className="w-5 h-5" style={{ color: k.color }} />
              </div>
            </div>
            <p className="text-xs text-[#6B7C72] mb-1">{k.label}</p>
            <p className="text-lg font-bold text-[#1A2E22]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1A2E22]">Alertes stock faible / rupture</h3>
            <button onClick={() => navigate('/gerant-principal/articles')} className="text-xs font-medium text-[#0B7439]">Voir tout</button>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-[#8AA898] py-4 text-center">Aucune alerte</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {lowStock.map(a => {
                const stock = a.computed_stock ?? 0
                const isOut = stock <= 0
                return (
                  <div key={a.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${
                    isOut ? 'bg-[#FEE2E2] border-[#FECACA]' : 'bg-[#FEF3C7] border-[#FDE68A]'
                  }`}>
                    <div>
                      <p className="text-sm font-medium text-[#1A2E22]">{a.designation}</p>
                      <p className="text-xs text-[#6B7C72]">{a.brand} {a.reference && `- ${a.reference}`}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isOut ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>{stock}</p>
                      <p className="text-[10px] text-[#6B7C72]">Seuil: {a.alert_threshold}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1A2E22]">Articles les plus sortis (mois)</h3>
            <button onClick={() => navigate('/gerant-principal/reports')} className="text-xs font-medium text-[#0B7439]">Rapports</button>
          </div>
          {topArticles.length === 0 ? (
            <p className="text-sm text-[#8AA898] py-4 text-center">Aucune sortie ce mois</p>
          ) : (
            <div className="space-y-2">
              {topArticles.map((a, i) => {
                const max = topArticles[0]?.total_qty ?? 1
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-[#6B7C72] w-5 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#1A2E22] truncate">{a.designation}</span>
                        <span className="text-sm font-bold text-[#0B7439] ml-2">{a.total_qty}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#E2EAE5]">
                        <div className="h-full rounded-full bg-[#0B7439] transition-all" style={{ width: `${(a.total_qty / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h3 className="font-bold text-[#1A2E22] mb-4">Consommation par societe</h3>
          {topCompanies.length === 0 ? (
            <p className="text-sm text-[#8AA898] py-4 text-center">Aucune donnee</p>
          ) : (
            <div className="space-y-2">
              {topCompanies.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                  <span className="text-sm font-medium text-[#1A2E22]">{c.name}</span>
                  <span className="text-sm font-bold text-[#AF3029]">{fmt(c.total)} FCFA</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
          <h3 className="font-bold text-[#1A2E22] mb-4">Consommation par bus</h3>
          {topBuses.length === 0 ? (
            <p className="text-sm text-[#8AA898] py-4 text-center">Aucune donnee</p>
          ) : (
            <div className="space-y-2">
              {topBuses.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#F8FAF8] border border-[#E2EAE5]">
                  <span className="text-sm font-medium text-[#1A2E22]">{b.reg}</span>
                  <span className="text-sm font-bold text-[#AF3029]">{fmt(b.total)} FCFA</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Entree de stock', path: '/gerant-principal/entries', icon: ArrowDownCircle, color: '#0891B2' },
          { label: 'Sortie de stock', path: '/gerant-principal/exits', icon: ArrowUpCircle, color: '#DC2626' },
          { label: 'Gestion pneus', path: '/gerant-principal/tires', icon: Disc, color: '#8B5CF6' },
          { label: 'Rapports', path: '/gerant-principal/reports', icon: BarChart2, color: '#0B7439' },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => navigate(a.path)}
            className="bg-white rounded-2xl border border-[#E2EAE5] p-5 text-left hover:shadow-md hover:border-[#0B7439]/30 transition-all group"
          >
            <a.icon className="w-6 h-6 mb-3 transition-transform group-hover:scale-110" style={{ color: a.color }} />
            <p className="font-bold text-sm text-[#1A2E22]">{a.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
