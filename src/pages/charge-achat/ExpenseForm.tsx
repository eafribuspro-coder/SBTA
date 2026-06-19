import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Car, Search, X, Building2, Wrench, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import type { ExpenseCategory, FleetVehicle } from '@/types/chargeAchat.types'

interface Company { id: string; name: string; code: string }
interface GarageOption { id: string; name: string; code: string; city: string; region: string | null }

interface FormData {
  company_id:           string
  registration_number:  string
  expense_date:         string
  category_id:          string
  description:          string
  supplier:             string
  amount:               string
  notes:                string
}

const EMPTY: FormData = {
  company_id: '', registration_number: '', expense_date: format(new Date(), 'yyyy-MM-dd'),
  category_id: '', description: '', supplier: '', amount: '', notes: '',
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return format(d, 'yyyy-MM-dd')
}

export default function ExpenseForm() {
  const navigate   = useNavigate()
  const { id }     = useParams<{ id?: string }>()
  const { user }   = useAuthStore()
  const isEdit     = !!id

  const [form,        setForm]        = useState<FormData>(EMPTY)
  const [loading,     setLoading]     = useState(false)
  const [companies,   setCompanies]   = useState<Company[]>([])
  const [categories,  setCategories]  = useState<ExpenseCategory[]>([])
  const [vehicles,    setVehicles]    = useState<FleetVehicle[]>([])
  const [garages,     setGarages]     = useState<GarageOption[]>([])

  // Garage selector state
  const [garageInput,       setGarageInput]       = useState('')
  const [showGarageSugg,    setShowGarageSugg]    = useState(false)
  const [selectedGarage,    setSelectedGarage]    = useState<GarageOption | null>(null)
  const garageRef = useRef<HTMLDivElement>(null)

  // Plate autocomplete state
  const [plateInput,       setPlateInput]       = useState('')
  const [showSuggestions,  setShowSuggestions]  = useState(false)
  const [selectedVehicle,  setSelectedVehicle]  = useState<FleetVehicle | null>(null)
  const [plateNotFound,    setPlateNotFound]     = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const plateInputRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadRef = async () => {
      const [companiesRes, categoriesRes, vehiclesRes, garagesRes] = await Promise.all([
        supabase.from('companies').select('id, name, code').order('name'),
        supabase.from('expense_categories').select('*').order('sort_order'),
        supabase.from('fleet_vehicles').select('*, company:companies(id,name,code)').eq('is_active', true),
        supabase.from('garages').select('id, name, code, city, region').neq('status', 'archive').order('name'),
      ])
      if (companiesRes.data) setCompanies(companiesRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
      if (vehiclesRes.data) setVehicles(vehiclesRes.data as FleetVehicle[])
      if (garagesRes.data) {
        const CHARGE_ACHAT_GARAGE_CODES = ['GAR-OD-001', 'GAR-BK-001', 'GAR-ALP-001', 'GAR-ADZ-001', 'GAR-SKS-001', 'GAR-YAM-001', 'GAR-ABG-001', 'GAR-BDK-001']
        const list = (garagesRes.data as GarageOption[]).filter(g => CHARGE_ACHAT_GARAGE_CODES.includes(g.code))
        setGarages(list)
      }
    }
    loadRef()
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        if (plateInput && !selectedVehicle) checkPlateNotFound(plateInput)
      }
      if (garageRef.current && !garageRef.current.contains(e.target as Node)) {
        setShowGarageSugg(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plateInput, selectedVehicle])

  // Load existing expense for edit
  useEffect(() => {
    if (!isEdit || !id) return
    supabase.from('vehicle_expenses').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          company_id:           data.company_id ?? '',
          registration_number:  data.registration_number ?? '',
          expense_date:         data.expense_date ?? '',
          category_id:          data.category_id ?? '',
          description:          data.description ?? '',
          supplier:             data.supplier ?? '',
          amount:               data.amount?.toString() ?? '',
          notes:                data.notes ?? '',
        })
        setPlateInput(data.registration_number ?? '')
        if (data.supplier) {
          setGarageInput(data.supplier)
          // Resolve garage object after garages are loaded
          setGarages(prev => {
            const found = prev.find(g => g.name === data.supplier || g.id === data.supplier)
            if (found) setSelectedGarage(found)
            return prev
          })
        }
      }
    })
  }, [isEdit, id])

  // Suggestions: all vehicles matching the typed plate (across all companies)
  const suggestions = plateInput.trim().length >= 1
    ? vehicles.filter(v =>
        v.registration_number.toLowerCase().includes(plateInput.toLowerCase())
      )
    : []

  const checkPlateNotFound = (plate: string) => {
    if (!plate.trim()) { setPlateNotFound(false); return }
    const found = vehicles.some(v => v.registration_number.toLowerCase() === plate.toLowerCase())
    setPlateNotFound(!found)
  }

  const selectVehicle = (vehicle: FleetVehicle) => {
    setSelectedVehicle(vehicle)
    setPlateInput(vehicle.registration_number)
    setForm(f => ({
      ...f,
      registration_number: vehicle.registration_number,
      company_id: vehicle.company_id,
    }))
    setShowSuggestions(false)
    setPlateNotFound(false)
  }

  const clearVehicle = () => {
    setSelectedVehicle(null)
    setPlateInput('')
    setPlateNotFound(false)
    setForm(f => ({ ...f, registration_number: '', company_id: '' }))
    setTimeout(() => plateInputRef.current?.focus(), 50)
  }

  const handlePlateInput = (value: string) => {
    const upper = value.toUpperCase()
    setPlateInput(upper)
    setSelectedVehicle(null)
    setPlateNotFound(false)
    setShowSuggestions(upper.trim().length >= 1)
    setForm(f => ({ ...f, registration_number: upper, company_id: '' }))
  }

  const handlePlateBlur = () => {
    // Small delay so click on suggestion fires first
    setTimeout(() => {
      if (!selectedVehicle && plateInput.trim()) {
        checkPlateNotFound(plateInput)
      }
      setShowSuggestions(false)
    }, 150)
  }

  // Company display for selected vehicle
  const selectedCompany = selectedVehicle
    ? (companies.find(c => c.id === selectedVehicle.company_id) ?? (selectedVehicle as any).company ?? null)
    : (isEdit && form.company_id ? companies.find(c => c.id === form.company_id) : null)

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const validate = () => {
    if (!form.registration_number.trim()) {
      toast.error("L'immatriculation est obligatoire")
      return false
    }
    if (!isEdit && !selectedVehicle) {
      toast.error('Aucun véhicule trouvé pour cette plaque d\'immatriculation.')
      return false
    }
    if (!form.company_id) {
      toast.error('La société est obligatoire')
      return false
    }
    if (!form.expense_date) {
      toast.error('La date est obligatoire')
      return false
    }
    if (!form.description.trim()) {
      toast.error('La description est obligatoire')
      return false
    }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      toast.error('Le montant est invalide')
      return false
    }
    return true
  }

  const save = async (addAnother = false) => {
    if (!validate()) return
    setLoading(true)

    const vehicleId = selectedVehicle?.id ?? (isEdit ? undefined : null)

    const payload = {
      company_id:           form.company_id,
      vehicle_id:           vehicleId ?? null,
      registration_number:  form.registration_number.trim().toUpperCase(),
      expense_date:         form.expense_date,
      week_start:           getWeekStart(form.expense_date),
      category_id:          form.category_id || null,
      description:          form.description.trim(),
      supplier:             form.supplier.trim() || null,
      amount:               Math.round(Number(form.amount)),
      notes:                form.notes.trim() || null,
      updated_at:           new Date().toISOString(),
      source:               'charge_achat',
    }

    try {
      if (isEdit) {
        const { error } = await supabase.from('vehicle_expenses').update(payload).eq('id', id)
        if (error) throw error
        toast.success('Dépense mise à jour')
      } else {
        const { error } = await supabase.from('vehicle_expenses')
          .insert({ ...payload, created_by: user?.id ?? null })
        if (error) throw error
        toast.success('Dépense enregistrée')
      }

      if (addAnother) {
        setForm({ ...EMPTY, expense_date: form.expense_date })
        setPlateInput('')
        setSelectedVehicle(null)
        setPlateNotFound(false)
      } else {
        navigate('/charge-achat/expenses')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500'
  const inputStyle = { backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  const vehicleIsValid = isEdit ? !!form.registration_number : !!selectedVehicle

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/charge-achat/expenses')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Modifier la dépense' : 'Nouvelle dépense véhicule'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isEdit ? 'Modifiez les informations' : "Saisir une dépense d'entretien ou réparation"}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* ── STEP 1: Plaque d'immatriculation ── */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Plaque d'immatriculation <span style={{ color: '#DC2626' }}>*</span>
          </label>

          {vehicleIsValid ? (
            /* Vehicle confirmed — show green badge */
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: '#d4edda', border: '1px solid #86efac' }}
            >
              <Car className="w-4 h-4 flex-shrink-0" style={{ color: '#0B7439' }} />
              <span className="font-mono font-bold text-sm flex-1" style={{ color: '#0B7439' }}>
                {form.registration_number}
              </span>
              {!isEdit && (
                <button
                  type="button"
                  onClick={clearVehicle}
                  className="p-0.5 rounded hover:bg-green-200 transition-colors"
                  title="Changer de véhicule"
                >
                  <X className="w-4 h-4" style={{ color: '#0B7439' }} />
                </button>
              )}
            </div>
          ) : (
            /* Autocomplete input */
            <div ref={suggestionsRef} className="relative">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  border: `1px solid ${plateNotFound ? '#DC2626' : 'var(--border)'}`,
                }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={plateInputRef}
                  value={plateInput}
                  onChange={e => handlePlateInput(e.target.value)}
                  onFocus={() => { if (plateInput.trim().length >= 1) setShowSuggestions(true) }}
                  onBlur={handlePlateBlur}
                  placeholder="ex: AA-266-GY-05"
                  className="flex-1 bg-transparent text-sm outline-none font-mono"
                  style={{ color: 'var(--text-primary)' }}
                  autoFocus={!isEdit}
                  autoComplete="off"
                />
                {plateInput && (
                  <button type="button" onMouseDown={() => { setPlateInput(''); setSelectedVehicle(null); setPlateNotFound(false); setForm(f => ({ ...f, registration_number: '', company_id: '' })); setShowSuggestions(false) }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 260 }}
                >
                  <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                    {suggestions.map(v => {
                      const co = companies.find(c => c.id === v.company_id) ?? (v as any).company
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onMouseDown={() => selectVehicle(v)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Car className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="font-mono font-bold text-sm flex-1" style={{ color: 'var(--text-primary)' }}>
                            {v.registration_number}
                          </span>
                          {co && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: '#d4edda', color: '#0B7439' }}
                            >
                              {co.code}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Not found error */}
              {plateNotFound && (
                <p className="mt-1.5 text-xs font-medium flex items-center gap-1" style={{ color: '#DC2626' }}>
                  <span>Aucun véhicule trouvé pour cette plaque d'immatriculation.</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── STEP 2: Société — read-only, auto-filled ── */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Société rattachée
          </label>
          {selectedCompany ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
            >
              <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: '#0B7439' }} />
              <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
                {selectedCompany.name}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-bold"
                style={{ backgroundColor: '#d4edda', color: '#0B7439' }}
              >
                {selectedCompany.code}
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-subtle)', border: '1px dashed var(--border)' }}
            >
              <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Remplie automatiquement après sélection de la plaque
              </span>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Date <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input type="date" value={form.expense_date} onChange={set('expense_date')} className={inputCls} style={inputStyle} />
        </div>

        {/* Garage / Lieu */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Garage / Lieu
          </label>

          {selectedGarage ? (
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
            >
              <Wrench className="w-4 h-4 flex-shrink-0" style={{ color: '#1D4ED8' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>{selectedGarage.name}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#3B82F6' }}>
                  <MapPin className="w-3 h-3" />
                  {selectedGarage.city}{selectedGarage.region ? ` — ${selectedGarage.region}` : ''}
                  <span className="ml-1 font-mono font-bold">{selectedGarage.code}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedGarage(null); setGarageInput(''); setForm(f => ({ ...f, supplier: '' })) }}
                className="p-0.5 rounded hover:bg-blue-100 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" style={{ color: '#1D4ED8' }} />
              </button>
            </div>
          ) : (
            <div ref={garageRef} className="relative">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={garageInput}
                  onChange={e => {
                    setGarageInput(e.target.value)
                    setForm(f => ({ ...f, supplier: e.target.value }))
                    setShowGarageSugg(e.target.value.trim().length >= 1)
                  }}
                  onFocus={() => { if (garageInput.trim().length >= 1) setShowGarageSugg(true) }}
                  onBlur={() => setTimeout(() => setShowGarageSugg(false), 150)}
                  placeholder="Rechercher un garage ou saisir un lieu…"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  autoComplete="off"
                />
                {garageInput && (
                  <button type="button" onMouseDown={() => { setGarageInput(''); setForm(f => ({ ...f, supplier: '' })); setShowGarageSugg(false) }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>

              {showGarageSugg && (() => {
                const q = garageInput.toLowerCase()
                const matches = garages.filter(g =>
                  g.name.toLowerCase().includes(q) ||
                  g.city.toLowerCase().includes(q) ||
                  g.code.toLowerCase().includes(q) ||
                  (g.region ?? '').toLowerCase().includes(q)
                )
                return matches.length > 0 ? (
                  <div
                    className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 240 }}
                  >
                    <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                      {matches.map(g => (
                        <button
                          key={g.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedGarage(g)
                            setGarageInput(g.name)
                            setForm(f => ({ ...f, supplier: g.name }))
                            setShowGarageSugg(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Wrench className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <MapPin className="w-3 h-3" />
                              {g.city}{g.region ? ` — ${g.region}` : ''}
                            </p>
                          </div>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-mono font-bold flex-shrink-0"
                            style={{ backgroundColor: '#d4edda', color: '#0B7439' }}
                          >
                            {g.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Catégorie</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, category_id: f.category_id === c.id ? '' : c.id }))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
                style={{
                  backgroundColor: form.category_id === c.id ? c.color + '20' : 'var(--bg-subtle)',
                  border: `1px solid ${form.category_id === c.id ? c.color : 'var(--border)'}`,
                  color: form.category_id === c.id ? c.color : 'var(--text-secondary)',
                }}
              >
                <span>{c.icon}</span>
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Description <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input value={form.description} onChange={set('description')} placeholder="ex: Dépannage flexible, Collage pneus…" className={inputCls} style={inputStyle} />
        </div>

        {/* Montant */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Montant (XOF) <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="500"
              value={form.amount}
              onChange={set('amount')}
              placeholder="0"
              className={inputCls + ' pr-14'}
              style={inputStyle}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>XOF</span>
          </div>
          {form.amount && !isNaN(Number(form.amount)) && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#0B7439' }}>
              {new Intl.NumberFormat('fr-FR').format(Number(form.amount))} XOF
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes (optionnel)</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            placeholder="Observations complémentaires…"
            className={inputCls}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => save(false)}
          disabled={loading || (!isEdit && !vehicleIsValid)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#0B7439', color: '#fff' }}
        >
          <Save className="w-4 h-4" />
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {!isEdit && (
          <button
            onClick={() => save(true)}
            disabled={loading || !vehicleIsValid}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <Plus className="w-4 h-4" />
            Enregistrer et ajouter une autre
          </button>
        )}
        <button
          onClick={() => navigate('/charge-achat/expenses')}
          className="px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          Annuler
        </button>
      </div>

    </div>
  )
}
