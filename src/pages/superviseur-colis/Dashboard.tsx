import React, { useState, useEffect, useCallback } from 'react'
import { Package, TrendingUp, Truck, MapPin, Banknote, RefreshCw, Eye, BarChart2, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { fetchParcelKPIs, fetchAllParcels } from '@/services/parcel.service'
import type { Parcel, ParcelKPIs, ParcelAgencyStat } from '@/types/parcel.types'

type Period = 'today' | 'week' | 'month'

export default function SuperviseurColisDashboard() {
  const [kpis, setKpis] = useState<ParcelKPIs | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [agencyStats, setAgencyStats] = useState<ParcelAgencyStat[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('today')
  const today = format(new Date(), 'dd/MM/yyyy', { locale: fr })

  const computeAgencyStats = useCallback((allParcels: Parcel[], selectedPeriod: Period) => {
    const now = new Date()
    let cutoff: Date
    if (selectedPeriod === 'today') { cutoff = new Date(now.toISOString().slice(0, 10)) }
    else if (selectedPeriod === 'week') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7) }
    else { cutoff = new Date(now.getFullYear(), now.getMonth(), 1) }

    const filtered = allParcels.filter(p => new Date(p.registered_at) >= cutoff)

    const map: Record<string, ParcelAgencyStat> = {}
    for (const p of filtered) {
      const sid = p.origin_station_id
      if (!map[sid]) {
        map[sid] = {
          station_id:       sid,
          station_name:     (p as any).origin_station?.name ?? p.origin_station_name ?? '—',
          company_name:     (p as any).companies?.name ?? p.company_name ?? '—',
          total_registered: 0,
          total_packaged:   0,
          total_shipped:    0,
          total_arrived:    0,
          total_delivered:  0,
          total_revenue:    0,
          period_revenue:   0,
        }
      }
      map[sid].total_registered++
      if (['mis_en_paquet','expedie','arrive','livre'].includes(p.status)) map[sid].total_packaged++
      if (['expedie','arrive','livre'].includes(p.status)) map[sid].total_shipped++
      if (['arrive','livre'].includes(p.status)) map[sid].total_arrived++
      if (p.status === 'livre') map[sid].total_delivered++
      map[sid].period_revenue += Number(p.total_amount ?? 0)
    }

    // total_revenue = all time
    for (const p of allParcels) {
      if (map[p.origin_station_id]) {
        map[p.origin_station_id].total_revenue += Number(p.total_amount ?? 0)
      }
    }

    return Object.values(map).sort((a, b) => b.period_revenue - a.period_revenue)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [k, all] = await Promise.all([fetchParcelKPIs(), fetchAllParcels()])
      setKpis(k)
      setParcels(all)
      setAgencyStats(computeAgencyStats(all, period))
    } catch (e: any) {
      toast.error('Erreur chargement données')
    } finally {
      setLoading(false)
    }
  }, [period, computeAgencyStats])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (parcels.length > 0) {
      setAgencyStats(computeAgencyStats(parcels, period))
    }
  }, [period, parcels, computeAgencyStats])

  const barData = agencyStats.slice(0, 8).map(s => ({
    name: s.station_name.length > 12 ? s.station_name.slice(0, 12) + '…' : s.station_name,
    CA: Math.round(s.period_revenue / 1000),
    enreg: s.total_registered,
  }))

  return (
    <div className="p-6 space-y-6" style={{ backgroundColor: 'var(--bg-subtle)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Supervision Courrier</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>SBTA Holding — {today}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {(['today', 'week', 'month'] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: period === p ? '#0B7439' : 'var(--surface)',
                  color: period === p ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {p === 'today' ? "Aujourd'hui" : p === 'week' ? '7 jours' : 'Ce mois'}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="p-2 rounded-lg border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Enregistrés aujourd'hui", value: kpis.total_today, icon: <Package className="w-5 h-5" />, color: '#0B7439', bg: '#d4edda' },
            { label: 'En transit', value: kpis.total_en_transit, icon: <Truck className="w-5 h-5" />, color: '#D97706', bg: '#FEF3C7' },
            { label: 'Arrivés', value: kpis.total_arrived, icon: <MapPin className="w-5 h-5" />, color: '#1D6FA4', bg: '#DBEAFE' },
            { label: 'Retirés', value: kpis.total_delivered, icon: <TrendingUp className="w-5 h-5" />, color: '#0B7439', bg: '#d4edda' },
            { label: "CA ce mois", value: kpis.total_revenue_month.toLocaleString('fr-CI') + ' F', icon: <Banknote className="w-5 h-5" />, color: '#0B7439', bg: '#f0faf4' },
          ].map(card => (
            <div key={card.label} className="rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div>
                <p className="text-xs leading-tight" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      {barData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <BarChart2 className="w-4 h-4" style={{ color: '#0B7439' }} />
              CA par agence (milliers FCFA)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v + 'k FCFA', 'CA']} />
                <Bar dataKey="CA" fill="#0B7439" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Calendar className="w-4 h-4" style={{ color: '#1D6FA4' }} />
              Enregistrements par agence
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, 'Courriers']} />
                <Bar dataKey="enreg" fill="#1D6FA4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Agency Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Détail par agence</h2>
        </div>
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {['AGENCE', 'ENREGISTRÉS', 'EN PAQUET', 'EXPÉDIÉS', 'ARRIVÉS', 'CA PÉRIODE', 'DÉTAIL'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-xs" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {agencyStats.map(stat => (
                  <tr key={stat.station_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {stat.station_name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#d4edda', color: '#0B7439' }}>
                        {stat.total_registered}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#DBEAFE', color: '#1D6FA4' }}>
                        {stat.total_packaged}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#D97706' }}>
                        {stat.total_shipped}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#d4edda', color: '#0B7439' }}>
                        {stat.total_arrived}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#0B7439' }}>
                      {stat.period_revenue.toLocaleString('fr-CI')} F
                    </td>
                    <td className="px-4 py-3">
                      <button className="p-1.5 rounded hover:bg-gray-100">
                        <Eye className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    </td>
                  </tr>
                ))}
                {agencyStats.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      Aucune donnée pour cette période
                    </td>
                  </tr>
                )}
              </tbody>
              {agencyStats.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: 'var(--text-primary)' }}>TOTAL</td>
                    <td className="px-4 py-3 text-center font-bold text-xs" style={{ color: '#0B7439' }}>
                      {agencyStats.reduce((s, a) => s + a.total_registered, 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-xs" style={{ color: '#1D6FA4' }}>
                      {agencyStats.reduce((s, a) => s + a.total_packaged, 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-xs" style={{ color: '#D97706' }}>
                      {agencyStats.reduce((s, a) => s + a.total_shipped, 0)}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-xs" style={{ color: '#0B7439' }}>
                      {agencyStats.reduce((s, a) => s + a.total_arrived, 0)}
                    </td>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: '#0B7439' }}>
                      {agencyStats.reduce((s, a) => s + a.period_revenue, 0).toLocaleString('fr-CI')} F
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
