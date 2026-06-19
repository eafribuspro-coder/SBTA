import { useState, useEffect, useCallback } from 'react'
import { Fuel, Plus, TrendingUp, Droplets, DollarSign, Bus, MapPin, ChevronRight, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuthStore } from '../../store/authStore'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Withdrawal {
  id: string
  registration_number: string
  driver_name: string | null
  station_name: string
  city: string | null
  fuel_type: string
  liters: number
  total_amount: number
  withdrawal_date: string
}

interface BusStat    { registration_number: string; liters: number; amount: number }
interface StationStat { station_name: string; liters: number; amount: number }
interface FuelTypeStat { fuel_type: string; liters: number; amount: number }

const FUEL_LABELS: Record<string, string> = { essence: 'Essence', gasoil: 'Gasoil' }
const FUEL_COLORS: Record<string, string> = { essence: '#F59E0B', gasoil: '#3B82F6' }

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}
function fmtL(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n) + ' L'
}

export default function CarburantDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)

  const today     = new Date()
  const todayStr  = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd   = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
  const monthEnd   = format(endOfMonth(today), 'yyyy-MM-dd')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('comptable_fuel_withdrawals')
      .select('id,registration_number,driver_name,station_name,city,fuel_type,liters,total_amount,withdrawal_date')
      .eq('created_by', user?.id ?? '')
      .gte('withdrawal_date', monthStart)
      .lte('withdrawal_date', monthEnd)
      .order('withdrawal_date', { ascending: false })
    setWithdrawals((data as Withdrawal[]) || [])
    setLoading(false)
  }, [user?.id, monthStart, monthEnd])

  useEffect(() => { load() }, [load])

  const byDate = (from: string, to: string) =>
    withdrawals.filter(w => w.withdrawal_date >= from && w.withdrawal_date <= to)

  const sum = (items: Withdrawal[]) => ({
    liters: items.reduce((s, w) => s + Number(w.liters), 0),
    amount: items.reduce((s, w) => s + Number(w.total_amount), 0),
  })

  const todayStats = sum(byDate(todayStr, todayStr))
  const weekStats  = sum(byDate(weekStart, weekEnd))
  const monthStats = sum(withdrawals)

  const busStat: BusStat[] = Object.values(
    withdrawals.reduce<Record<string, BusStat>>((acc, w) => {
      if (!acc[w.registration_number]) acc[w.registration_number] = { registration_number: w.registration_number, liters: 0, amount: 0 }
      acc[w.registration_number].liters += Number(w.liters)
      acc[w.registration_number].amount += Number(w.total_amount)
      return acc
    }, {})
  ).sort((a, b) => b.liters - a.liters).slice(0, 8)

  const stationStat: StationStat[] = Object.values(
    withdrawals.reduce<Record<string, StationStat>>((acc, w) => {
      if (!acc[w.station_name]) acc[w.station_name] = { station_name: w.station_name, liters: 0, amount: 0 }
      acc[w.station_name].liters += Number(w.liters)
      acc[w.station_name].amount += Number(w.total_amount)
      return acc
    }, {})
  ).sort((a, b) => b.liters - a.liters).slice(0, 6)

  const fuelTypeStat: FuelTypeStat[] = Object.values(
    withdrawals.reduce<Record<string, FuelTypeStat>>((acc, w) => {
      if (!acc[w.fuel_type]) acc[w.fuel_type] = { fuel_type: w.fuel_type, liters: 0, amount: 0 }
      acc[w.fuel_type].liters += Number(w.liters)
      acc[w.fuel_type].amount += Number(w.total_amount)
      return acc
    }, {})
  )

  const maxBusLiters     = Math.max(...busStat.map(b => b.liters), 1)
  const maxStationLiters = Math.max(...stationStat.map(s => s.liters), 1)
  const recent           = withdrawals.slice(0, 5)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Carburant
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Tableau de bord — {format(today, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/carburant/report')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            <FileText className="w-4 h-4" />
            Rapports
          </button>
          <button
            onClick={() => navigate('/carburant/new')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0B7439' }}
          >
            <Plus className="w-4 h-4" />
            Nouveau prélèvement
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {[
              { period: "Aujourd'hui",  ...todayStats,  color: '#3B82F6' },
              { period: 'Cette semaine', ...weekStats,  color: '#0B7439' },
              { period: 'Ce mois',       ...monthStats, color: '#F59E0B' },
            ].map(kpi => (
              <div key={kpi.period} className="rounded-2xl border p-6"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                  {kpi.period}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Droplets className="w-4 h-4" style={{ color: kpi.color }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Litres</span>
                    </div>
                    <p className="text-2xl font-black" style={{ color: kpi.color }}>{fmtL(kpi.liters)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="w-4 h-4" style={{ color: kpi.color }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Montant</span>
                    </div>
                    <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(kpi.amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* By bus */}
            <div className="lg:col-span-2 rounded-2xl border p-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Bus className="w-5 h-5" style={{ color: '#0B7439' }} />
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Consommation par bus</h2>
                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>(ce mois)</span>
              </div>
              {busStat.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune donnée ce mois</p>
              ) : (
                <div className="space-y-3">
                  {busStat.map(b => (
                    <div key={b.registration_number}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>{b.registration_number}</span>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>{fmtL(b.liters)}</span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(b.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${(b.liters / maxBusLiters) * 100}%`, backgroundColor: '#0B7439' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By fuel type */}
            <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Fuel className="w-5 h-5" style={{ color: '#F59E0B' }} />
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Par type</h2>
              </div>
              {fuelTypeStat.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
              ) : (
                <div className="space-y-4">
                  {fuelTypeStat.map(ft => (
                    <div key={ft.fuel_type} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: FUEL_COLORS[ft.fuel_type] || '#6B7280' }} />
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {FUEL_LABELS[ft.fuel_type] || ft.fuel_type}
                        </span>
                      </div>
                      <p className="text-xl font-black" style={{ color: FUEL_COLORS[ft.fuel_type] || '#6B7280' }}>{fmtL(ft.liters)}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{fmt(ft.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* By station + recents */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-5 h-5" style={{ color: '#16A34A' }} />
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Consommation par station</h2>
              </div>
              {stationStat.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Aucune donnée</p>
              ) : (
                <div className="space-y-3">
                  {stationStat.map(s => (
                    <div key={s.station_name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{s.station_name}</span>
                        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>{fmtL(s.liters)}</span>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(s.amount)}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${(s.liters / maxStationLiters) * 100}%`, backgroundColor: '#16A34A' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent */}
            <div className="rounded-2xl border p-6" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" style={{ color: '#0B7439' }} />
                  <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Derniers prélèvements</h2>
                </div>
                <button onClick={() => navigate('/carburant/report')}
                  className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0B7439' }}>
                  Tout voir <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {recent.length === 0 ? (
                <div className="text-center py-8">
                  <Fuel className="w-10 h-10 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aucun prélèvement ce mois</p>
                  <button onClick={() => navigate('/carburant/new')}
                    className="mt-3 text-sm font-semibold" style={{ color: '#0B7439' }}>
                    + Enregistrer un prélèvement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recent.map(w => (
                    <div key={w.id} className="flex items-center justify-between py-2 border-b last:border-0"
                      style={{ borderColor: 'var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {w.registration_number}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ backgroundColor: `${FUEL_COLORS[w.fuel_type]}20`, color: FUEL_COLORS[w.fuel_type] }}>
                            {FUEL_LABELS[w.fuel_type] || w.fuel_type}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {w.station_name}{w.city ? ` · ${w.city}` : ''}
                          {w.driver_name ? ` · ${w.driver_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtL(w.liters)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {format(new Date(w.withdrawal_date + 'T00:00:00'), 'dd MMM', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
