import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, ShieldAlert, ShieldX, Wallet, CarFront, Wrench,
  Bell, Plus, FileText, ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/utils/formatCurrency'
import {
  fetchInsurances, fetchBuses, buildAlerts, effectiveStatus, alertLevel,
  type InsuranceBus,
} from '@/services/insurance.service'
import type { VehicleInsurance, InsuranceAlert } from '@/types/insurance.types'

const LEVEL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  green:  { bg: '#E7F6EC', text: '#0B7439', dot: '#16A34A' },
  orange: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
  red:    { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  blue:   { bg: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  gray:   { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
}

export default function AssuranceDashboard() {
  const navigate = useNavigate()
  const [insurances, setInsurances] = useState<VehicleInsurance[]>([])
  const [buses, setBuses] = useState<InsuranceBus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchInsurances(), fetchBuses()])
      .then(([ins, bs]) => { setInsurances(ins); setBuses(bs) })
      .catch((err) => { console.error(err); toast.error('Erreur lors du chargement') })
      .finally(() => setLoading(false))
  }, [])

  const stats = useMemo(() => {
    const current = insurances.filter(i => i.is_current)
    const actives = current.filter(i => {
      const s = effectiveStatus(i)
      return s === 'actif' || s === 'proche_echeance'
    })
    const expirees = current.filter(i => effectiveStatus(i) === 'expire')
    const proches = current.filter(i => effectiveStatus(i) === 'proche_echeance')
    const montantTotal = actives.reduce((s, i) => s + Number(i.amount ?? 0), 0)

    const insuredBusIds = new Set(current.map(i => i.bus_id).filter(Boolean) as string[])
    const nonAssures = buses.filter(b => (b.is_active ?? true) && !insuredBusIds.has(b.id))
    const enGarage = buses.filter(b => (b.status && b.status !== 'active') || b.is_active === false)

    return {
      actives: actives.length,
      expirees: expirees.length,
      proches: proches.length,
      montantTotal,
      nonAssures,
      enGarage: enGarage.length,
    }
  }, [insurances, buses])

  const alerts: InsuranceAlert[] = useMemo(() => buildAlerts(insurances), [insurances])

  const kpis = [
    { label: 'Assurances actives', value: stats.actives, icon: ShieldCheck, color: '#0B7439', bg: '#E7F6EC' },
    { label: 'Proches échéance', value: stats.proches, icon: ShieldAlert, color: '#B45309', bg: '#FEF3C7' },
    { label: 'Assurances expirées', value: stats.expirees, icon: ShieldX, color: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Montant total assuré', value: formatCurrency(stats.montantTotal), icon: Wallet, color: '#1D4ED8', bg: '#DBEAFE' },
    { label: 'Véhicules non assurés', value: stats.nonAssures.length, icon: CarFront, color: '#B91C1C', bg: '#FEE2E2' },
    { label: 'Véhicules en garage / inactifs', value: stats.enGarage, icon: Wrench, color: '#6B7280', bg: '#F3F4F6' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A2E22]">Tableau de bord Assurance</h1>
          <p className="text-sm text-[#6B7280] mt-1">Gestion des assurances de la flotte</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/assurance/insurances/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B7439] text-white text-sm font-medium hover:bg-[#095e2f] transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle assurance
          </button>
          <button
            onClick={() => navigate('/assurance/reports')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2EAE5] text-[#4A6B55] text-sm font-medium hover:bg-[#F8FAF8] transition-colors"
          >
            <FileText className="w-4 h-4" /> Rapports
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="bg-white rounded-2xl border border-[#E2EAE5] p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
                <Icon className="w-6 h-6" style={{ color: kpi.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] font-medium">{kpi.label}</p>
                <p className="text-xl font-bold text-[#1A2E22] truncate">{kpi.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notification box */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2EAE5]">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#0B7439]" />
              <h2 className="font-semibold text-[#1A2E22]">Alertes du mois</h2>
              {alerts.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] font-semibold animate-pulse">
                  {alerts.length}
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-[#F0F4F1] max-h-[420px] overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#6B7280]">
                <ShieldCheck className="w-10 h-10 text-[#16A34A] mb-2" />
                <p className="text-sm">Aucune alerte. Toutes les assurances sont à jour.</p>
              </div>
            ) : (
              alerts.map(a => {
                const c = LEVEL_COLORS[a.level]
                return (
                  <button
                    key={a.insurance.id}
                    onClick={() => navigate(`/assurance/insurances/${a.insurance.id}/edit`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAF8] transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: c.dot }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A2E22] truncate">{a.message}</p>
                      <p className="text-xs text-[#8AA898]">
                        {a.insurance.assureur} · échéance {new Date(a.insurance.expiry_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ backgroundColor: c.bg, color: c.text }}>
                      J{a.threshold === 0 ? '' : '-' + a.threshold}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Non assurés */}
        <div className="bg-white rounded-2xl border border-[#E2EAE5] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2EAE5]">
            <div className="flex items-center gap-2">
              <CarFront className="w-5 h-5 text-[#B91C1C]" />
              <h2 className="font-semibold text-[#1A2E22]">Véhicules non assurés</h2>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C] font-semibold">
              {stats.nonAssures.length}
            </span>
          </div>
          <div className="divide-y divide-[#F0F4F1] max-h-[420px] overflow-y-auto">
            {stats.nonAssures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[#6B7280]">
                <ShieldCheck className="w-10 h-10 text-[#16A34A] mb-2" />
                <p className="text-sm">Tous les véhicules actifs sont assurés.</p>
              </div>
            ) : (
              stats.nonAssures.map(b => (
                <button
                  key={b.id}
                  onClick={() => navigate(`/assurance/insurances/new?bus=${b.id}`)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F8FAF8] transition-colors text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-bold text-[#0B7439]">{b.registration_number}</p>
                    <p className="text-xs text-[#8AA898] truncate">{[b.brand, b.model].filter(Boolean).join(' ') || '—'}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl border border-[#E2EAE5] p-5">
        <h3 className="text-sm font-semibold text-[#1A2E22] mb-3">Légende des alertes</h3>
        <div className="flex flex-wrap gap-5">
          {[
            { c: 'green',  l: 'Assurance valide' },
            { c: 'orange', l: 'Échéance dans 30 jours' },
            { c: 'red',    l: 'Assurance expirée' },
            { c: 'blue',   l: 'Renouvellement effectué' },
          ].map(item => (
            <div key={item.c} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: LEVEL_COLORS[item.c].dot }} />
              <span className="text-sm text-[#4A6B55]">{item.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
