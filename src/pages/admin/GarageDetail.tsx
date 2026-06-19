import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Users, Bus, ClipboardList, BarChart2,
  Wrench, Phone, Mail, MapPin, Plus, Trash2, AlertTriangle,
  CheckCircle, Clock, RefreshCw, FileText,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../../services/supabase'
import {
  fetchGarageById,
  fetchGarageStaff,
  fetchBusesInGarage,
  fetchQuotesByGarage,
  addGarageStaff,
  removeGarageStaff,
  type BusInGarage,
} from '../../services/garage.service'
import type { Garage, MaintenanceQuote, GarageStaffMember } from '../../types/garage.types'
import { formatCurrency } from '../../utils/formatCurrency'

type Tab = 'info' | 'equipe' | 'bus' | 'devis' | 'stats'

const BUS_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  panne_route:      { label: 'En panne',      color: '#DC2626', bg: '#FEE2E2' },
  reception_garage: { label: 'Reçu garage',   color: '#D97706', bg: '#FEF3C7' },
  diagnostic:       { label: 'Diagnostic',    color: '#2563EB', bg: '#DBEAFE' },
  attente_ot:       { label: 'Attente OT',    color: '#7C3AED', bg: '#EDE9FE' },
  maintenance:      { label: 'Maintenance',   color: '#059669', bg: '#D1FAE5' },
  controle_qualite: { label: 'Ctrl. qualité', color: '#0891B2', bg: '#CFFAFE' },
  disponible:       { label: 'Disponible',    color: '#16A34A', bg: '#DCFCE7' },
  en_service:       { label: 'En service',    color: '#16A34A', bg: '#DCFCE7' },
}

const QUOTE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:        { label: 'Brouillon',      color: '#6B7280', bg: '#F3F4F6' },
  soumis_comptable: { label: 'Soumis',         color: '#D97706', bg: '#FEF3C7' },
  valide:           { label: 'Validé',         color: '#16A34A', bg: '#DCFCE7' },
  rejete:           { label: 'Rejeté',         color: '#DC2626', bg: '#FEE2E2' },
  converti_en_ot:   { label: 'OT créé',        color: '#2563EB', bg: '#DBEAFE' },
  annule:           { label: 'Annulé',         color: '#9CA3AF', bg: '#F9FAFB' },
}

const PIE_COLORS = ['#0B7439', '#AF3029', '#D97706', '#2563EB', '#7C3AED', '#0891B2']

export default function GarageDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('info')
  const [garage, setGarage]   = useState<Garage | null>(null)
  const [staff, setStaff]     = useState<GarageStaffMember[]>([])
  const [buses, setBuses]     = useState<BusInGarage[]>([])
  const [quotes, setQuotes]   = useState<MaintenanceQuote[]>([])
  const [loading, setLoading] = useState(true)

  // Add staff modal state
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffUsers, setStaffUsers]     = useState<{ id: string; full_name: string; role: string }[]>([])
  const [newStaffUser, setNewStaffUser] = useState('')
  const [newStaffRole, setNewStaffRole] = useState('mecanicien')

  // Bus filter
  const [busCompanyFilter, setBusCompanyFilter] = useState('')
  const [busStatusFilter,  setBusStatusFilter]  = useState('')

  // Quote filter
  const [quoteCompanyFilter, setQuoteCompanyFilter] = useState('')
  const [quoteStatusFilter,  setQuoteStatusFilter]  = useState('')

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [g, st, b, q] = await Promise.all([
        fetchGarageById(id),
        fetchGarageStaff(id),
        fetchBusesInGarage(id),
        fetchQuotesByGarage(id),
      ])
      setGarage(g)
      setStaff(st)
      setBuses(b)
      setQuotes(q)
    } catch (e: any) {
      toast.error(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Load available users for staff addition
  useEffect(() => {
    if (!showAddStaff) return
    supabase.from('users').select('id, full_name, role')
      .in('role', ['chef_garage', 'mecanicien'])
      .eq('status', 'active')
      .then(({ data }) => setStaffUsers(data ?? []))
  }, [showAddStaff])

  const handleAddStaff = async () => {
    if (!newStaffUser || !id) return
    try {
      const { data: user } = await supabase.auth.getUser()
      await addGarageStaff(id, newStaffUser, newStaffRole, user.user?.id ?? '')
      toast.success('Agent ajouté')
      setShowAddStaff(false)
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleRemoveStaff = async (staffId: string) => {
    try {
      await removeGarageStaff(staffId)
      toast.success('Agent retiré')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (loading) return <div className="p-8">Chargement...</div>
  if (!garage) return <div className="p-8">Garage introuvable</div>

  // Companies in this garage
  const busCompanies = [...new Set(buses.map(b => b.company_name))].sort()
  const filteredBuses = buses.filter(b => {
    if (busCompanyFilter && b.company_name !== busCompanyFilter) return false
    if (busStatusFilter && b.status !== busStatusFilter) return false
    return true
  })
  const filteredQuotes = quotes.filter(q => {
    if (quoteCompanyFilter && q.bus_company_name !== quoteCompanyFilter) return false
    if (quoteStatusFilter && q.status !== quoteStatusFilter) return false
    return true
  })

  // Stats data
  const companyCosts: Record<string, number> = {}
  quotes.filter(q => q.status === 'converti_en_ot' || q.status === 'valide').forEach(q => {
    companyCosts[q.bus_company_name] = (companyCosts[q.bus_company_name] ?? 0) + q.total_estimated_cost
  })
  const costChartData = Object.entries(companyCosts).map(([name, cost]) => ({ name, cost }))

  const typeCount: Record<string, number> = {}
  quotes.forEach(q => { typeCount[q.maintenance_type] = (typeCount[q.maintenance_type] ?? 0) + 1 })
  const typeChartData = Object.entries(typeCount).map(([name, value]) => ({
    name: name === 'corrective' ? 'Corrective' : name === 'preventive' ? 'Préventive' : 'Urgence',
    value,
  }))

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'info',   label: 'Informations', icon: <Building2 className="w-4 h-4" /> },
    { id: 'equipe', label: 'Équipe',       icon: <Users className="w-4 h-4" /> },
    { id: 'bus',    label: 'Bus en garage',icon: <Bus className="w-4 h-4" /> },
    { id: 'devis',  label: 'Devis',        icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'stats',  label: 'Statistiques', icon: <BarChart2 className="w-4 h-4" /> },
  ]

  const statusCfg = garage.status === 'actif'
    ? { bg: '#DCFCE7', color: '#16A34A', label: 'Actif' }
    : garage.status === 'inactif'
    ? { bg: '#FEF3C7', color: '#D97706', label: 'Inactif' }
    : { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Back + Header */}
      <button onClick={() => navigate('/admin/garages')} className="flex items-center gap-2 mb-6 text-sm font-medium" style={{ color: '#4A6B55' }}>
        <ArrowLeft className="w-4 h-4" /> Retour aux garages
      </button>

      <div className="bg-white rounded-2xl border mb-6" style={{ borderColor: '#E2EAE5' }}>
        <div className="p-6 border-b" style={{ borderColor: '#E2EAE5' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: garage.garage_type === 'central' ? '#F0FBF4' : '#FFF7ED' }}>
                {garage.garage_type === 'central'
                  ? <Building2 className="w-7 h-7" style={{ color: '#0B7439' }} />
                  : <Wrench className="w-7 h-7" style={{ color: '#D97706' }} />}
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-sm font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                    {garage.code}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                    {statusCfg.label}
                  </span>
                </div>
                <h1 className="text-2xl font-bold" style={{ color: '#1A2E22' }}>{garage.name}</h1>
                <p className="text-sm mt-1" style={{ color: '#4A6B55' }}>
                  Sert toutes les sociétés · Capacité : {garage.max_vehicles} véhicules max
                </p>
              </div>
            </div>
            {/* KPI row */}
            <div className="hidden md:flex gap-6">
              <KPI label="Bus en garage" value={garage.buses_in_garage} />
              <KPI label="Devis en attente" value={garage.quotes_pending} warn={garage.quotes_pending > 0} />
              <KPI label="OT en cours" value={garage.ots_in_progress} />
              <KPI label="Coût ce mois" value={formatCurrency(garage.cost_this_month)} isText />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 border-b overflow-x-auto" style={{ borderColor: '#E2EAE5' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap"
              style={{
                color:           tab === t.id ? '#0B7439' : '#4A6B55',
                borderBottom:    tab === t.id ? '2px solid #0B7439' : '2px solid transparent',
                backgroundColor: 'transparent',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* ─ Informations ─ */}
          {tab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoGroup title="Identification">
                <InfoRow label="Type" value={garage.garage_type === 'central' ? 'Garage Central' : 'Sous-Garage'} />
                <InfoRow label="Code" value={garage.code} />
                {garage.parent_name && <InfoRow label="Garage parent" value={garage.parent_name} />}
              </InfoGroup>
              <InfoGroup title="Localisation">
                {garage.address && <InfoRow label="Adresse" value={garage.address} />}
                <InfoRow label="Ville" value={garage.city} />
                {garage.region && <InfoRow label="Région" value={garage.region} />}
              </InfoGroup>
              <InfoGroup title="Contacts">
                {garage.phone && <InfoRow label="Téléphone" value={garage.phone} icon={<Phone className="w-3.5 h-3.5" />} />}
                {garage.email && <InfoRow label="Email" value={garage.email} icon={<Mail className="w-3.5 h-3.5" />} />}
              </InfoGroup>
              <InfoGroup title="Organisation">
                {garage.station_name && <InfoRow label="Gare associée" value={garage.station_name} />}
                {garage.chef_name    && <InfoRow label="Chef de garage" value={garage.chef_name} />}
                <InfoRow label="Équipe" value={`${garage.staff_count} agent(s) actif(s)`} />
              </InfoGroup>
              {garage.observations && (
                <div className="col-span-2">
                  <InfoGroup title="Observations">
                    <p className="text-sm" style={{ color: '#4A6B55' }}>{garage.observations}</p>
                  </InfoGroup>
                </div>
              )}
            </div>
          )}

          {/* ─ Équipe ─ */}
          {tab === 'equipe' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base" style={{ color: '#1A2E22' }}>
                  Équipe du garage ({staff.filter(s => s.is_active).length} membres)
                </h3>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 text-white"
                  style={{ backgroundColor: '#0B7439' }}
                >
                  <Plus className="w-4 h-4" /> Ajouter un agent
                </button>
              </div>
              {staff.filter(s => s.is_active).length === 0 ? (
                <EmptyState icon={<Users className="w-10 h-10" />} msg="Aucun agent affecté à ce garage" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#F4F7F5' }}>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Nom</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Rôle</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Depuis</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {staff.filter(s => s.is_active).map(s => (
                      <tr key={s.id} className="border-t" style={{ borderColor: '#E2EAE5' }}>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: '#1A2E22' }}>
                          {s.user?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                            {s.role_in_garage.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: '#4A6B55' }}>
                          {format(new Date(s.assigned_at), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleRemoveStaff(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" style={{ color: '#AF3029' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Add staff modal */}
              {showAddStaff && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                    <h3 className="font-bold mb-4" style={{ color: '#1A2E22' }}>Ajouter un agent</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: '#1A2E22' }}>Agent</label>
                        <select value={newStaffUser} onChange={e => setNewStaffUser(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-sm" style={{ borderColor: '#E2EAE5' }}>
                          <option value="">Sélectionner...</option>
                          {staffUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1" style={{ color: '#1A2E22' }}>Rôle dans le garage</label>
                        <select value={newStaffRole} onChange={e => setNewStaffRole(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-sm" style={{ borderColor: '#E2EAE5' }}>
                          <option value="chef_garage">Chef de garage</option>
                          <option value="mecanicien">Mécanicien</option>
                          <option value="aide_mecanicien">Aide-mécanicien</option>
                          <option value="technicien">Technicien</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                      <button onClick={() => setShowAddStaff(false)}
                        className="flex-1 px-4 py-2 border rounded-xl text-sm font-semibold" style={{ borderColor: '#E2EAE5', color: '#4A6B55' }}>
                        Annuler
                      </button>
                      <button onClick={handleAddStaff}
                        className="flex-1 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: '#0B7439' }}>
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Bus en garage ─ */}
          {tab === 'bus' && (
            <div>
              <div className="flex gap-3 mb-4">
                <select value={busCompanyFilter} onChange={e => setBusCompanyFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
                  <option value="">Toutes sociétés</option>
                  {busCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={busStatusFilter} onChange={e => setBusStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
                  <option value="">Tous statuts</option>
                  {Object.entries(BUS_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}
                </select>
              </div>
              {filteredBuses.length === 0 ? (
                <EmptyState icon={<Bus className="w-10 h-10" />} msg="Aucun bus actuellement dans ce garage" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#F4F7F5' }}>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Bus</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Modèle</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Société</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBuses.map(b => {
                      const sc = BUS_STATUS_LABELS[b.status] ?? { label: b.status, color: '#6B7280', bg: '#F3F4F6' }
                      return (
                        <tr key={b.id} className="border-t" style={{ borderColor: '#E2EAE5' }}>
                          <td className="px-4 py-3 font-bold text-sm" style={{ color: '#1A2E22' }}>{b.registration_number}</td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#4A6B55' }}>{b.brand} {b.model}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                              {b.company_name}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.color }}>
                              {sc.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─ Devis ─ */}
          {tab === 'devis' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-3">
                  <select value={quoteCompanyFilter} onChange={e => setQuoteCompanyFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
                    <option value="">Toutes sociétés</option>
                    {[...new Set(quotes.map(q => q.bus_company_name))].sort().map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select value={quoteStatusFilter} onChange={e => setQuoteStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
                    <option value="">Tous statuts</option>
                    {Object.entries(QUOTE_STATUS).map(([v, l]) => <option key={v} value={v}>{l.label}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => navigate('/garage/quotes/new')}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                  style={{ backgroundColor: '#0B7439' }}
                >
                  <Plus className="w-4 h-4" /> Nouveau devis
                </button>
              </div>
              {filteredQuotes.length === 0 ? (
                <EmptyState icon={<ClipboardList className="w-10 h-10" />} msg="Aucun devis pour ce garage" />
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#F4F7F5' }}>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>N° Devis</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Bus</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Société</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Montant</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Statut</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotes.map(q => {
                      const qs = QUOTE_STATUS[q.status] ?? { label: q.status, color: '#6B7280', bg: '#F3F4F6' }
                      return (
                        <tr key={q.id} className="border-t hover:bg-gray-50" style={{ borderColor: '#E2EAE5' }}>
                          <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#0B7439' }}>{q.quote_number}</td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1A2E22' }}>{q.bus_registration}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                              {q.bus_company_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1A2E22' }}>{formatCurrency(q.total_estimated_cost)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: qs.bg, color: qs.color }}>
                              {qs.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: '#4A6B55' }}>
                            {format(new Date(q.created_at), 'dd/MM/yyyy', { locale: fr })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ─ Statistiques ─ */}
          {tab === 'stats' && (
            <div className="space-y-6">
              {/* Company costs */}
              <div>
                <h3 className="font-bold mb-4" style={{ color: '#1A2E22' }}>Coûts par société</h3>
                {costChartData.length === 0 ? (
                  <EmptyState icon={<BarChart2 className="w-8 h-8" />} msg="Aucune donnée disponible" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={costChartData}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Bar dataKey="cost" fill="#0B7439" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Type breakdown */}
              <div>
                <h3 className="font-bold mb-4" style={{ color: '#1A2E22' }}>Répartition par type d'intervention</h3>
                {typeChartData.length === 0 ? (
                  <EmptyState icon={<BarChart2 className="w-8 h-8" />} msg="Aucune donnée disponible" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={typeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {typeChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Summary table by company */}
              <div>
                <h3 className="font-bold mb-3" style={{ color: '#1A2E22' }}>Résumé par société</h3>
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: '#F4F7F5' }}>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Société</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Devis</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Coût estimé total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      quotes.reduce((acc, q) => {
                        if (!acc[q.bus_company_name]) acc[q.bus_company_name] = { count: 0, cost: 0 }
                        acc[q.bus_company_name].count++
                        acc[q.bus_company_name].cost += q.total_estimated_cost
                        return acc
                      }, {} as Record<string, { count: number; cost: number }>)
                    ).sort((a, b) => b[1].cost - a[1].cost).map(([name, data]) => (
                      <tr key={name} className="border-t" style={{ borderColor: '#E2EAE5' }}>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>{name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1A2E22' }}>{data.count}</td>
                        <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#0B7439' }}>{formatCurrency(data.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function KPI({ label, value, warn, isText }: { label: string; value: number | string; warn?: boolean; isText?: boolean }) {
  return (
    <div className="text-center">
      <div className="text-xl font-bold" style={{ color: warn ? '#D97706' : '#1A2E22' }}>{value}</div>
      <div className="text-xs" style={{ color: '#9AB4A0' }}>{label}</div>
    </div>
  )
}

function InfoGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4" style={{ backgroundColor: '#F4F7F5' }}>
      <h4 className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: '#9AB4A0' }}>{label}</span>
      <span className="font-medium flex items-center gap-1" style={{ color: '#1A2E22' }}>
        {icon}{value}
      </span>
    </div>
  )
}

function EmptyState({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-3" style={{ color: '#D1DFD6' }}>{icon}</div>
      <p className="text-sm" style={{ color: '#9AB4A0' }}>{msg}</p>
    </div>
  )
}
