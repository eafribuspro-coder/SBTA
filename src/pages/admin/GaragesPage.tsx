import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wrench, Plus, Search, Building2, Users, Bus, ClipboardList, CheckCircle2, XCircle, CreditCard as Edit2, Eye, ChevronDown, X, MapPin, Phone, Mail, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../services/supabase'
import {
  fetchGarages, fetchGaragesSimple, createGarage, updateGarage,
} from '../../services/garage.service'
import type { Garage, GarageType, GarageStatus } from '../../types/garage.types'
import { formatCurrency } from '../../utils/formatCurrency'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<GarageStatus, { bg: string; text: string; label: string }> = {
  actif:    { bg: '#DCFCE7', text: '#16A34A', label: 'Actif' },
  inactif:  { bg: '#FEF3C7', text: '#D97706', label: 'Inactif' },
  archive:  { bg: '#F3F4F6', text: '#6B7280', label: 'Archivé' },
}

const TYPE_LABELS: Record<GarageType, string> = {
  central:     'Garage Central',
  sous_garage: 'Sous-Garage',
}

// ── Garage Form Modal ─────────────────────────────────────────────────────────

interface GarageFormProps {
  initial?: Partial<Garage>
  onClose: () => void
  onSaved: () => void
}

function GarageForm({ initial, onClose, onSaved }: GarageFormProps) {
  const isEdit = !!initial?.id
  const [saving, setSaving] = useState(false)
  const [centrals, setCentrals] = useState<{ id: string; name: string }[]>([])
  const [stations, setStations] = useState<{ id: string; name: string }[]>([])
  const [chefs, setChefs] = useState<{ id: string; full_name: string }[]>([])

  const [form, setForm] = useState({
    name:             initial?.name ?? '',
    code:             initial?.code ?? '',
    garage_type:      (initial?.garage_type ?? 'sous_garage') as GarageType,
    parent_garage_id: initial?.parent_garage_id ?? '',
    address:          initial?.address ?? '',
    city:             initial?.city ?? '',
    region:           initial?.region ?? '',
    phone:            initial?.phone ?? '',
    email:            initial?.email ?? '',
    station_id:       initial?.station_id ?? '',
    chef_garage_id:   initial?.chef_garage_id ?? '',
    max_vehicles:     initial?.max_vehicles ?? 20,
    status:           (initial?.status ?? 'actif') as GarageStatus,
    observations:     initial?.observations ?? '',
  })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    Promise.all([
      supabase.from('garages').select('id, name').eq('garage_type', 'central').neq('status', 'archive'),
      supabase.from('stations').select('id, name').order('name'),
      supabase.from('users').select('id, full_name').eq('role', 'chef_garage').eq('status', 'active'),
    ]).then(([c, s, ch]) => {
      setCentrals(c.data ?? [])
      setStations(s.data ?? [])
      setChefs(ch.data ?? [])
    })
  }, [])

  const handleSave = async () => {
    if (!form.name || !form.code || !form.city) {
      toast.error('Nom, code et ville sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        parent_garage_id: form.parent_garage_id || null,
        station_id:       form.station_id       || null,
        chef_garage_id:   form.chef_garage_id   || null,
      }
      if (isEdit) {
        await updateGarage(initial!.id!, payload)
        toast.success('Garage mis à jour')
      } else {
        await createGarage(payload)
        toast.success('Garage créé')
      }
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E2EAE5' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A2E22' }}>
              {isEdit ? 'Modifier le garage' : 'Nouveau garage'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#4A6B55' }}>
              Un garage SBTA sert toutes les sociétés de la holding
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" style={{ color: '#4A6B55' }} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Notice */}
          <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: '#F0FBF4', border: '1px solid #BBF7D0' }}>
            <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#0B7439' }} />
            <p className="text-xs" style={{ color: '#0B7439' }}>
              Un garage SBTA n'est <strong>pas rattaché à une société spécifique</strong>.
              Il prend en charge les véhicules de <strong>toutes les sociétés</strong>.
            </p>
          </div>

          {/* Identification */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Identification</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Nom du garage *</label>
                <input
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Ex: Garage Central Abidjan"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Code / Référence *</label>
                <input
                  value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="GAR-ABJ-01"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none font-mono"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Type *</label>
                <select
                  value={form.garage_type}
                  onChange={e => set('garage_type', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                >
                  <option value="central">Garage Central</option>
                  <option value="sous_garage">Sous-Garage</option>
                </select>
              </div>
              {form.garage_type === 'sous_garage' && (
                <div className="col-span-2">
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Garage central parent (optionnel)</label>
                  <select
                    value={form.parent_garage_id}
                    onChange={e => set('parent_garage_id', e.target.value)}
                    className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                    style={{ borderColor: '#E2EAE5' }}
                  >
                    <option value="">— Sélectionner si applicable —</option>
                    {centrals.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Localisation */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Localisation</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Adresse complète</label>
                <input
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Zone Industrielle Vridi, Abidjan"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Ville *</label>
                <input
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  placeholder="Abidjan"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Région</label>
                <input
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                  placeholder="Lagunes"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
            </div>
          </section>

          {/* Contacts */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Contacts</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Téléphone</label>
                <input
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+225 07 00 00 00"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="garage@sbta.ci"
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
            </div>
          </section>

          {/* Rattachements */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Rattachements</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Gare associée (optionnel)</label>
                <select
                  value={form.station_id}
                  onChange={e => set('station_id', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                >
                  <option value="">— Aucune gare —</option>
                  {stations.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Capacité max. véhicules</label>
                <input
                  type="number"
                  min={1}
                  value={form.max_vehicles}
                  onChange={e => set('max_vehicles', parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
            </div>
          </section>

          {/* Responsable */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Responsable</h3>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Chef de garage</label>
              <select
                value={form.chef_garage_id}
                onChange={e => set('chef_garage_id', e.target.value)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
              >
                <option value="">— Sélectionner un chef de garage —</option>
                {chefs.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Statut & Notes */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#4A6B55' }}>Statut & Notes</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Statut</label>
                <div className="flex gap-4">
                  {(['actif', 'inactif'] as GarageStatus[]).map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={() => set('status', s)}
                        className="accent-[#0B7439]"
                      />
                      <span className="text-sm" style={{ color: '#1A2E22' }}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Observations</label>
                <textarea
                  value={form.observations}
                  onChange={e => set('observations', e.target.value)}
                  rows={3}
                  placeholder="Notes sur ce garage..."
                  className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none"
                  style={{ borderColor: '#E2EAE5' }}
                  onFocus={e => (e.target.style.borderColor = '#0B7439')}
                  onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center" style={{ borderColor: '#E2EAE5' }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border-2 rounded-xl text-sm font-semibold"
            style={{ borderColor: '#E2EAE5', color: '#4A6B55' }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{ backgroundColor: saving ? '#9AB4A0' : '#0B7439' }}
          >
            {saving ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer le garage'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GaragesPage() {
  const navigate = useNavigate()
  const [garages, setGarages] = useState<Garage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Garage | null>(null)

  const [search,    setSearch]    = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('actif')

  const load = async () => {
    try {
      const data = await fetchGarages()
      setGarages(data)
    } catch (e: any) {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cities = [...new Set(garages.map(g => g.city))].sort()

  const filtered = garages.filter(g => {
    if (typeFilter && g.garage_type !== typeFilter) return false
    if (cityFilter && g.city !== cityFilter) return false
    if (statusFilter && g.status !== statusFilter) return false
    if (search) {
      const s = search.toLowerCase()
      return g.name.toLowerCase().includes(s) || g.code.toLowerCase().includes(s) || g.city.toLowerCase().includes(s)
    }
    return true
  })

  const centrals   = filtered.filter(g => g.garage_type === 'central')
  const sousGarages = filtered.filter(g => g.garage_type === 'sous_garage')
  const [tab, setTab] = useState<'all' | 'central' | 'sous_garage'>('all')
  const displayed = tab === 'all' ? filtered : tab === 'central' ? centrals : sousGarages

  if (loading) return <div className="p-8">Chargement...</div>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#1A2E22' }}>
            Gestion des Garages
          </h1>
          <p className="text-sm" style={{ color: '#4A6B55' }}>
            Les garages SBTA sont indépendants des sociétés — ils servent toute la holding
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-5 py-2.5 rounded-xl text-white font-semibold flex items-center gap-2 text-sm"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Plus className="w-4 h-4" />
          Nouveau garage
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6" style={{ borderColor: '#E2EAE5' }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9AB4A0' }} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              style={{ borderColor: '#E2EAE5' }}
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
            <option value="">Tous types</option>
            <option value="central">Garage Central</option>
            <option value="sous_garage">Sous-Garage</option>
          </select>
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
            <option value="">Toutes villes</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" style={{ borderColor: '#E2EAE5' }}>
            <option value="">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="archive">Archivé</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([['all', `Tous (${filtered.length})`], ['central', `Garages centraux (${centrals.length})`], ['sous_garage', `Sous-garages (${sousGarages.length})`]] as [string, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v as any)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === v ? '#0B7439' : '#F4F7F5',
              color:           tab === v ? '#fff'     : '#4A6B55',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {displayed.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border" style={{ borderColor: '#E2EAE5' }}>
            <Wrench className="w-12 h-12 mx-auto mb-3" style={{ color: '#9AB4A0' }} />
            <p style={{ color: '#4A6B55' }}>Aucun garage trouvé</p>
          </div>
        ) : displayed.map(g => {
          const sc = STATUS_COLORS[g.status]
          return (
            <div key={g.id} className="bg-white rounded-xl border p-5" style={{ borderColor: '#E2EAE5' }}>
              <div className="flex items-start justify-between gap-4">
                {/* Left */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: g.garage_type === 'central' ? '#F0FBF4' : '#FFF7ED' }}
                  >
                    {g.garage_type === 'central'
                      ? <Building2 className="w-6 h-6" style={{ color: '#0B7439' }} />
                      : <Wrench className="w-6 h-6" style={{ color: '#D97706' }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                        {g.code}
                      </span>
                      <h3 className="font-bold text-base" style={{ color: '#1A2E22' }}>{g.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#F4F7F5', color: '#4A6B55' }}>
                        {TYPE_LABELS[g.garage_type]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm mb-3" style={{ color: '#4A6B55' }}>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{g.city}{g.region ? ` · ${g.region}` : ''}</span>
                      {g.chef_name && (
                        <><span className="mx-2 opacity-40">·</span><span>Chef : <strong>{g.chef_name}</strong></span></>
                      )}
                    </div>
                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      <StatChip icon={<Users className="w-3.5 h-3.5" />} value={g.staff_count} label="agents" />
                      <StatChip icon={<Bus className="w-3.5 h-3.5" />} value={g.buses_in_garage} label="bus en garage" />
                      <StatChip icon={<Building2 className="w-3.5 h-3.5" />} value={g.companies_served} label="sociétés servies" />
                      <StatChip icon={<ClipboardList className="w-3.5 h-3.5" />} value={g.quotes_pending} label="devis en attente" color={g.quotes_pending > 0 ? '#D97706' : undefined} />
                      <StatChip icon={<AlertTriangle className="w-3.5 h-3.5" />} value={g.ots_in_progress} label="OT en cours" />
                      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#0B7439' }}>
                        <span>{formatCurrency(g.cost_this_month)}</span>
                        <span style={{ color: '#9AB4A0' }}>ce mois</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/admin/garages/${g.id}`)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                    style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Détail
                  </button>
                  <button
                    onClick={() => { setEditing(g); setShowForm(true) }}
                    className="p-2 rounded-lg hover:bg-gray-100"
                  >
                    <Edit2 className="w-4 h-4" style={{ color: '#4A6B55' }} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <GarageForm
          initial={editing ?? undefined}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={load}
        />
      )}
    </div>
  )
}

function StatChip({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color: color ?? '#4A6B55' }}>
      {icon}
      <strong>{value}</strong>
      <span style={{ color: color ?? '#9AB4A0' }}>{label}</span>
    </div>
  )
}
