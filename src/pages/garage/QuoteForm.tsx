import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Bus, Building2, Plus, Trash2, Search, AlertTriangle, CheckCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../services/supabase'
import { createQuote, submitQuote } from '../../services/garage.service'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/formatCurrency'
import type { PartsItem } from '../../types/garage.types'

const LABOR_RATE_DEFAULT = 5000 // FCFA/h

interface BusOption {
  id:               string
  registration_number: string
  brand:            string
  model:            string
  year:             number
  status:           string
  company_id:       string
  company_name:     string
  current_garage_id: string | null
}

interface SparePart {
  id:        string
  name:      string
  reference: string
  quantity:  number
  unit_cost: number
}

export default function QuoteForm() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user } = useAuthStore()

  const [saving, setSaving] = useState(false)
  const [myGarage, setMyGarage] = useState<{ id: string; name: string; code: string } | null>(null)
  const [buses, setBuses] = useState<BusOption[]>([])
  const [spareParts, setSpareParts] = useState<SparePart[]>([])

  // Section 1
  const [selectedBus, setSelectedBus]  = useState<BusOption | null>(null)
  const [maintenanceType, setMaintenanceType] = useState<'preventive' | 'corrective' | 'urgence'>('corrective')
  const [urgency, setUrgency]          = useState<'faible' | 'normale' | 'elevee' | 'critique'>('normale')
  const [title, setTitle]              = useState('')
  const [problem, setProblem]          = useState('')
  const [solution, setSolution]        = useState('')
  const [mileage, setMileage]          = useState('')
  const [startDate, setStartDate]      = useState('')
  const [duration, setDuration]        = useState('')

  // Section 2
  const [laborHours, setLaborHours]    = useState(0)
  const [laborRate, setLaborRate]      = useState(LABOR_RATE_DEFAULT)
  const laborCost = laborHours * laborRate

  // Section 3
  const [partSearch, setPartSearch]    = useState('')
  const [parts, setParts]              = useState<PartsItem[]>([])
  const partsCost = parts.reduce((s, p) => s + p.total, 0)
  const totalCost = laborCost + partsCost

  // Section 5
  const [observations, setObservations] = useState('')

  useEffect(() => {
    if (!user) return
    // Get chef's garage
    supabase
      .from('garage_staff')
      .select('garage_id, garages(id, name, code)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.garages) {
          const g = data.garages as any
          setMyGarage({ id: g.id, name: g.name, code: g.code })
          // Load buses in this garage or in breakdown status
          supabase
            .from('buses')
            .select('id, registration_number, brand, model, year, status, company_id, companies(name), current_garage_id')
            .or(`current_garage_id.eq.${g.id},status.eq.panne_route,status.eq.reception_garage,status.eq.diagnostic,status.eq.attente_ot`)
            .then(({ data: busData }) => {
              setBuses((busData ?? []).map((b: any) => ({
                ...b,
                company_name: b.companies?.name ?? '—',
              })))
            })
        }
      })
    // Load spare parts
    supabase.from('spare_parts').select('id, name, reference, quantity, unit_cost').order('name')
      .then(({ data }) => setSpareParts(data ?? []))

    // Pre-select bus from query param
    const busId = params.get('bus_id')
    if (busId) {
      supabase.from('buses').select('id, registration_number, brand, model, year, status, company_id, companies(name), current_garage_id')
        .eq('id', busId).maybeSingle()
        .then(({ data }) => {
          if (data) setSelectedBus({ ...data, company_name: (data as any).companies?.name ?? '—' } as BusOption)
        })
    }
  }, [user, params])

  const addPartFromStock = (part: SparePart) => {
    setParts(prev => {
      const existing = prev.find(p => p.part_name === part.name)
      if (existing) {
        return prev.map(p => p.part_name === part.name
          ? { ...p, qty: p.qty + 1, total: (p.qty + 1) * p.unit_price }
          : p)
      }
      return [...prev, {
        part_name:  part.name,
        qty:        1,
        unit_price: part.unit_cost,
        total:      part.unit_cost,
        from_stock: true,
        available:  part.quantity > 0,
      }]
    })
    setPartSearch('')
  }

  const addCustomPart = () => {
    setParts(prev => [...prev, { part_name: '', qty: 1, unit_price: 0, total: 0, from_stock: false, available: true }])
  }

  const updatePart = (idx: number, field: keyof PartsItem, val: any) => {
    setParts(prev => prev.map((p, i) => {
      if (i !== idx) return p
      const updated = { ...p, [field]: val }
      if (field === 'qty' || field === 'unit_price') {
        updated.total = updated.qty * updated.unit_price
      }
      return updated
    }))
  }

  const removePart = (idx: number) => setParts(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async (andSubmit = false) => {
    if (!myGarage || !selectedBus || !title || !problem) {
      toast.error('Garage, bus, titre et description sont obligatoires')
      return
    }
    setSaving(true)
    try {
      const payload = {
        garage_id:           myGarage.id,
        bus_id:              selectedBus.id,
        created_by:          user!.id,
        maintenance_type:    maintenanceType,
        urgency_level:       urgency,
        title,
        problem_description: problem,
        proposed_solution:   solution || null,
        labor_hours:         laborHours,
        labor_hourly_rate:   laborRate,
        labor_cost:          laborCost,
        parts_items:         parts,
        parts_cost:          partsCost,
        total_estimated_cost: totalCost,
        observations:        observations || null,
        mileage:             mileage ? parseInt(mileage) : null,
        planned_start_date:  startDate || null,
        estimated_duration_days: duration ? parseInt(duration) : null,
        status:              'brouillon',
      }
      const quoteId = await createQuote(payload as any)
      if (andSubmit) {
        await submitQuote(quoteId, null)
        toast.success(`Devis soumis au comptable de ${selectedBus.company_name}`)
      } else {
        toast.success('Devis enregistré en brouillon')
      }
      navigate('/garage/quotes')
    } catch (e: any) {
      toast.error(e.message || 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const filteredParts = partSearch.length >= 2
    ? spareParts.filter(p =>
        p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
        p.reference?.toLowerCase().includes(partSearch.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 mb-6 text-sm font-medium" style={{ color: '#4A6B55' }}>
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A2E22' }}>Nouveau Devis</h1>
        {myGarage && (
          <p className="text-sm mt-1" style={{ color: '#4A6B55' }}>
            {myGarage.name} — <span className="font-mono font-bold" style={{ color: '#0B7439' }}>{myGarage.code}</span>
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* SECTION 1 — Identification */}
        <Section title="Section 1 — Identification">
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Garage</label>
            <div className="px-4 py-2.5 border-2 rounded-xl text-sm bg-gray-50" style={{ borderColor: '#E2EAE5', color: '#4A6B55' }}>
              {myGarage ? myGarage.name : 'Chargement...'}
            </div>
          </div>

          {/* Bus selector */}
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Bus concerné *</label>
            <select
              value={selectedBus?.id ?? ''}
              onChange={e => {
                const b = buses.find(x => x.id === e.target.value)
                setSelectedBus(b ?? null)
              }}
              className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
            >
              <option value="">Sélectionner un bus...</option>
              {buses.map(b => (
                <option key={b.id} value={b.id}>
                  {b.registration_number} — {b.brand} {b.model} ({b.company_name})
                </option>
              ))}
            </select>
          </div>

          {/* Bus info card */}
          {selectedBus && (
            <div className="flex items-start gap-3 p-4 rounded-xl border-2" style={{ backgroundColor: '#F0FBF4', borderColor: '#BBF7D0' }}>
              <Bus className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: '#0B7439' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: '#1A2E22' }}>
                  {selectedBus.registration_number} · {selectedBus.brand} {selectedBus.model} {selectedBus.year}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Building2 className="w-3.5 h-3.5" style={{ color: '#4A6B55' }} />
                  <p className="text-xs" style={{ color: '#4A6B55' }}>
                    Société propriétaire : <strong>{selectedBus.company_name}</strong>
                  </p>
                </div>
                <p className="text-xs mt-1" style={{ color: '#6B9A7B' }}>
                  Le devis sera soumis au COMPTABLE de {selectedBus.company_name}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Type d'intervention *</label>
              <div className="flex gap-4">
                {([['preventive', 'Préventive'], ['corrective', 'Corrective'], ['urgence', 'Urgence']] as [string, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" value={v} checked={maintenanceType === v}
                      onChange={() => setMaintenanceType(v as any)} className="accent-[#0B7439]" />
                    <span className="text-sm">{l}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>Urgence</label>
              <div className="flex gap-3 flex-wrap">
                {([['faible', 'Faible'], ['normale', 'Normale'], ['elevee', 'Élevée'], ['critique', 'Critique']] as [string, string][]).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="urgency" value={v} checked={urgency === v}
                      onChange={() => setUrgency(v as any)} className="accent-[#0B7439]" />
                    <span className="text-xs">{l}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Field label="Titre *">
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Remplacement courroie de distribution"
              className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
          </Field>
          <Field label="Description du problème *">
            <textarea value={problem} onChange={e => setProblem(e.target.value)} rows={3}
              placeholder="Décrire le problème constaté..."
              className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
          </Field>
          <Field label="Solution proposée">
            <textarea value={solution} onChange={e => setSolution(e.target.value)} rows={2}
              placeholder="Solution envisagée..."
              className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
          </Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Kilométrage actuel (km)">
              <input type="number" value={mileage} onChange={e => setMileage(e.target.value)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
                onFocus={e => (e.target.style.borderColor = '#0B7439')}
                onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
            </Field>
            <Field label="Début prévu">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
                onFocus={e => (e.target.style.borderColor = '#0B7439')}
                onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
            </Field>
            <Field label="Durée estimée (jours)">
              <input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
                onFocus={e => (e.target.style.borderColor = '#0B7439')}
                onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
            </Field>
          </div>
        </Section>

        {/* SECTION 2 — Main d'oeuvre */}
        <Section title="Section 2 — Main d'oeuvre">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Heures estimées">
              <input type="number" min="0" step="0.5" value={laborHours}
                onChange={e => setLaborHours(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
                onFocus={e => (e.target.style.borderColor = '#0B7439')}
                onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
            </Field>
            <Field label="Taux horaire (FCFA/h)">
              <input type="number" min="0" value={laborRate}
                onChange={e => setLaborRate(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
                style={{ borderColor: '#E2EAE5' }}
                onFocus={e => (e.target.style.borderColor = '#0B7439')}
                onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
            </Field>
            <Field label="Sous-total MO">
              <div className="px-4 py-2.5 border-2 rounded-xl text-sm font-bold bg-gray-50"
                style={{ borderColor: '#E2EAE5', color: '#0B7439' }}>
                {formatCurrency(laborCost)}
              </div>
            </Field>
          </div>
        </Section>

        {/* SECTION 3 — Pièces détachées */}
        <Section title="Section 3 — Pièces détachées">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9AB4A0' }} />
            <input
              value={partSearch}
              onChange={e => setPartSearch(e.target.value)}
              placeholder="Rechercher une pièce dans le stock..."
              className="w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')}
            />
            {filteredParts.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-xl overflow-hidden" style={{ borderColor: '#E2EAE5' }}>
                {filteredParts.map(p => (
                  <button key={p.id} type="button"
                    onMouseDown={() => addPartFromStock(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-sm text-left"
                  >
                    <div>
                      <span className="font-medium" style={{ color: '#1A2E22' }}>{p.name}</span>
                      {p.reference && <span className="ml-2 text-xs" style={{ color: '#9AB4A0' }}>{p.reference}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#4A6B55' }}>{formatCurrency(p.unit_cost)}</span>
                      {p.quantity > 0
                        ? <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                            Stock: {p.quantity}
                          </span>
                        : <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                            Rupture
                          </span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Parts table */}
          {parts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F4F7F5' }}>
                    <th className="text-left px-3 py-2 text-xs font-semibold" style={{ color: '#4A6B55' }}>Désignation</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold" style={{ color: '#4A6B55' }}>Qté</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: '#4A6B55' }}>Prix unit.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold" style={{ color: '#4A6B55' }}>Total</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold" style={{ color: '#4A6B55' }}>Dispo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: '#E2EAE5' }}>
                      <td className="px-3 py-2">
                        <input value={p.part_name} onChange={e => updatePart(i, 'part_name', e.target.value)}
                          placeholder="Nom de la pièce"
                          className="w-full px-2 py-1 border rounded-lg text-sm"
                          style={{ borderColor: '#E2EAE5' }} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="1" value={p.qty}
                          onChange={e => updatePart(i, 'qty', parseInt(e.target.value) || 1)}
                          className="w-16 text-center px-2 py-1 border rounded-lg text-sm"
                          style={{ borderColor: '#E2EAE5' }} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" min="0" value={p.unit_price}
                          onChange={e => updatePart(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-28 text-right px-2 py-1 border rounded-lg text-sm"
                          style={{ borderColor: '#E2EAE5' }} />
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold" style={{ color: '#1A2E22' }}>
                        {formatCurrency(p.total)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {p.available
                          ? <CheckCircle className="w-4 h-4 mx-auto" style={{ color: '#16A34A' }} />
                          : <AlertTriangle className="w-4 h-4 mx-auto" style={{ color: '#DC2626' }} />}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => removePart(i)} className="p-1 hover:bg-red-50 rounded">
                          <Trash2 className="w-4 h-4" style={{ color: '#AF3029' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={addCustomPart}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border-2 border-dashed"
            style={{ borderColor: '#0B7439', color: '#0B7439' }}>
            <Plus className="w-4 h-4" /> Ajouter une pièce manuellement
          </button>
        </Section>

        {/* SECTION 4 — Récapitulatif */}
        <Section title="Section 4 — Récapitulatif">
          <div className="rounded-xl p-5" style={{ backgroundColor: '#F0FBF4', border: '1px solid #BBF7D0' }}>
            <div className="space-y-2 mb-3">
              <SumRow label="Sous-total main d'oeuvre" value={formatCurrency(laborCost)} />
              <SumRow label="Sous-total pièces" value={formatCurrency(partsCost)} />
              <div className="border-t pt-2" style={{ borderColor: '#BBF7D0' }}>
                <SumRow label="TOTAL ESTIMÉ" value={formatCurrency(totalCost)} bold />
              </div>
            </div>
            {selectedBus && (
              <p className="text-xs mt-2" style={{ color: '#4A6B55' }}>
                Sera facturé à : <strong>{selectedBus.company_name}</strong>
              </p>
            )}
          </div>
        </Section>

        {/* SECTION 5 — Observations */}
        <Section title="Section 5 — Observations">
          <Field label="Observations">
            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none"
              style={{ borderColor: '#E2EAE5' }}
              onFocus={e => (e.target.style.borderColor = '#0B7439')}
              onBlur={e => (e.target.style.borderColor = '#E2EAE5')} />
          </Field>
        </Section>
      </div>

      {/* Footer buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: '#E2EAE5' }}>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 border-2 rounded-xl text-sm font-semibold"
          style={{ borderColor: '#E2EAE5', color: '#4A6B55' }}
        >
          Annuler
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-5 py-2.5 border-2 rounded-xl text-sm font-semibold"
            style={{ borderColor: '#0B7439', color: '#0B7439' }}
          >
            Sauvegarder en brouillon
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !selectedBus}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{ backgroundColor: saving || !selectedBus ? '#9AB4A0' : '#0B7439' }}
          >
            {saving ? 'Envoi...' : `Soumettre au comptable ${selectedBus?.company_name ?? ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6" style={{ borderColor: '#E2EAE5' }}>
      <h2 className="text-sm font-bold uppercase tracking-wide mb-4" style={{ color: '#4A6B55' }}>{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1.5" style={{ color: '#1A2E22' }}>{label}</label>
      {children}
    </div>
  )
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: '#4A6B55', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: '#1A2E22', fontWeight: bold ? 700 : 600 }}>{value}</span>
    </div>
  )
}
