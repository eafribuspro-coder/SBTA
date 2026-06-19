import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Search, X, Wrench, MapPin, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import type { FixedExpenseType } from '@/types/chargeAchat.types'

interface GarageOption { id: string; name: string; code: string; city: string; region: string | null }

interface FormData {
  expense_type_id: string
  garage_id: string
  zone: string
  expense_date: string
  amount: string
  supplier: string
  invoice_reference: string
  observation: string
}

const EMPTY: FormData = {
  expense_type_id: '', garage_id: '', zone: '',
  expense_date: format(new Date(), 'yyyy-MM-dd'),
  amount: '', supplier: '', invoice_reference: '', observation: '',
}

const CHARGE_ACHAT_GARAGE_CODES = [
  'GAR-OD-001', 'GAR-BK-001', 'GAR-ALP-001', 'GAR-ADZ-001',
  'GAR-SKS-001', 'GAR-YAM-001', 'GAR-ABG-001', 'GAR-BDK-001',
]

export default function FixedExpenseForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { user } = useAuthStore()
  const isEdit = !!id

  const [form, setForm] = useState<FormData>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [expenseTypes, setExpenseTypes] = useState<FixedExpenseType[]>([])
  const [garages, setGarages] = useState<GarageOption[]>([])

  const [typeInput, setTypeInput] = useState('')
  const [showTypeSugg, setShowTypeSugg] = useState(false)
  const [selectedType, setSelectedType] = useState<FixedExpenseType | null>(null)
  const [creatingType, setCreatingType] = useState(false)
  const typeRef = useRef<HTMLDivElement>(null)

  const [garageInput, setGarageInput] = useState('')
  const [showGarageSugg, setShowGarageSugg] = useState(false)
  const [selectedGarage, setSelectedGarage] = useState<GarageOption | null>(null)
  const garageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('fixed_expense_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('garages').select('id, name, code, city, region').neq('status', 'archive').order('name'),
    ]).then(([typesRes, garagesRes]) => {
      if (typesRes.data) setExpenseTypes(typesRes.data as FixedExpenseType[])
      if (garagesRes.data) {
        setGarages((garagesRes.data as GarageOption[]).filter(g => CHARGE_ACHAT_GARAGE_CODES.includes(g.code)))
      }
    })
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) setShowTypeSugg(false)
      if (garageRef.current && !garageRef.current.contains(e.target as Node)) setShowGarageSugg(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!isEdit || !id) return
    supabase.from('fixed_expenses')
      .select('*, expense_type:fixed_expense_types(*), garage:garages(id, name, city, region)')
      .eq('id', id).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setForm({
          expense_type_id: data.expense_type_id ?? '',
          garage_id: data.garage_id ?? '',
          zone: data.zone ?? '',
          expense_date: data.expense_date ?? '',
          amount: data.amount?.toString() ?? '',
          supplier: data.supplier ?? '',
          invoice_reference: data.invoice_reference ?? '',
          observation: data.observation ?? '',
        })
        if (data.expense_type) {
          setSelectedType(data.expense_type as FixedExpenseType)
          setTypeInput(data.expense_type.name)
        }
        if (data.garage) {
          const g = data.garage as GarageOption
          setSelectedGarage({ ...g, code: '' })
          setGarageInput(g.name)
        }
      })
  }, [isEdit, id])

  const typeMatches = typeInput.trim().length >= 1
    ? expenseTypes.filter(t => t.name.toLowerCase().includes(typeInput.toLowerCase()))
    : expenseTypes

  const exactMatch = expenseTypes.some(t => t.name.toLowerCase() === typeInput.trim().toLowerCase())

  const createNewType = async () => {
    const name = typeInput.trim()
    if (!name) return
    setCreatingType(true)
    try {
      const maxOrder = expenseTypes.reduce((m, t) => Math.max(m, t.sort_order), 0)
      const { data, error } = await supabase.from('fixed_expense_types')
        .insert({ name, icon: '📋', color: '#6B7280', sort_order: maxOrder + 1 })
        .select().single()
      if (error) throw error
      const newType = data as FixedExpenseType
      setExpenseTypes(prev => [...prev, newType])
      setSelectedType(newType)
      setForm(f => ({ ...f, expense_type_id: newType.id }))
      setShowTypeSugg(false)
      toast.success(`Type "${name}" cree`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur creation type')
    } finally {
      setCreatingType(false)
    }
  }

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }))
  }

  const validate = () => {
    if (!form.expense_type_id) { toast.error('Le type de depense est obligatoire'); return false }
    if (!form.expense_date) { toast.error('La date est obligatoire'); return false }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) { toast.error('Le montant est invalide'); return false }
    return true
  }

  const save = async (addAnother = false) => {
    if (!validate()) return
    setLoading(true)
    const payload = {
      expense_type_id: form.expense_type_id,
      garage_id: form.garage_id || null,
      zone: form.zone.trim() || (selectedGarage ? `${selectedGarage.city}${selectedGarage.region ? ' - ' + selectedGarage.region : ''}` : null),
      expense_date: form.expense_date,
      amount: Math.round(Number(form.amount)),
      supplier: form.supplier.trim() || null,
      invoice_reference: form.invoice_reference.trim() || null,
      observation: form.observation.trim() || null,
      updated_at: new Date().toISOString(),
    }
    try {
      if (isEdit) {
        const { error } = await supabase.from('fixed_expenses').update(payload).eq('id', id)
        if (error) throw error
        toast.success('Charge fixe mise a jour')
      } else {
        const { error } = await supabase.from('fixed_expenses')
          .insert({ ...payload, created_by: user?.id ?? null })
        if (error) throw error
        toast.success('Charge fixe enregistree')
      }
      if (addAnother) {
        setForm({ ...EMPTY, expense_date: form.expense_date, garage_id: form.garage_id, zone: form.zone })
        setSelectedType(null); setTypeInput('')
      } else {
        navigate('/charge-achat/fixed-expenses')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500'
  const inputStyle = { backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/charge-achat/fixed-expenses')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isEdit ? 'Modifiez les informations' : 'Saisir une charge fixe (electricite, loyer, eau...)'}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5 space-y-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Type de depense with autocomplete */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Type de depense <span style={{ color: '#DC2626' }}>*</span>
          </label>
          {selectedType ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: selectedType.color + '18', border: `1px solid ${selectedType.color}40` }}>
              <span className="text-lg">{selectedType.icon}</span>
              <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>{selectedType.name}</span>
              <button type="button" onClick={() => { setSelectedType(null); setTypeInput(''); setForm(f => ({ ...f, expense_type_id: '' })) }}
                className="p-0.5 rounded hover:bg-white/50 transition-colors">
                <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          ) : (
            <div ref={typeRef} className="relative">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={inputStyle}>
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={typeInput}
                  onChange={e => { setTypeInput(e.target.value); setShowTypeSugg(true) }}
                  onFocus={() => setShowTypeSugg(true)}
                  placeholder="Rechercher ou creer un type..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                  autoComplete="off"
                  autoFocus={!isEdit}
                />
                {typeInput && (
                  <button type="button" onMouseDown={() => { setTypeInput(''); setShowTypeSugg(false) }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
              {showTypeSugg && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 280 }}>
                  <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                    {typeMatches.map(t => (
                      <button key={t.id} type="button"
                        onMouseDown={() => {
                          setSelectedType(t); setTypeInput(t.name)
                          setForm(f => ({ ...f, expense_type_id: t.id })); setShowTypeSugg(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                        <span className="text-lg">{t.icon}</span>
                        <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                      </button>
                    ))}
                    {typeInput.trim() && !exactMatch && (
                      <button type="button" onMouseDown={createNewType} disabled={creatingType}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left border-t hover:bg-green-50 transition-colors"
                        style={{ borderColor: 'var(--border)' }}>
                        <Plus className="w-4 h-4" style={{ color: '#0B7439' }} />
                        <span className="text-sm font-semibold" style={{ color: '#0B7439' }}>
                          {creatingType ? 'Creation...' : `Creer "${typeInput.trim()}"`}
                        </span>
                      </button>
                    )}
                    {typeMatches.length === 0 && (!typeInput.trim() || exactMatch) && (
                      <p className="px-4 py-3 text-sm text-center" style={{ color: 'var(--text-muted)' }}>Aucun type trouve</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Garage */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Garage concerne</label>
          {selectedGarage ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <Wrench className="w-4 h-4 flex-shrink-0" style={{ color: '#1D4ED8' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>{selectedGarage.name}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#3B82F6' }}>
                  <MapPin className="w-3 h-3" />{selectedGarage.city}{selectedGarage.region ? ` - ${selectedGarage.region}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => { setSelectedGarage(null); setGarageInput(''); setForm(f => ({ ...f, garage_id: '', zone: '' })) }}
                className="p-0.5 rounded hover:bg-blue-100 transition-colors flex-shrink-0">
                <X className="w-4 h-4" style={{ color: '#1D4ED8' }} />
              </button>
            </div>
          ) : (
            <div ref={garageRef} className="relative">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={inputStyle}>
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <input value={garageInput}
                  onChange={e => { setGarageInput(e.target.value); setShowGarageSugg(e.target.value.trim().length >= 1) }}
                  onFocus={() => { if (garageInput.trim().length >= 1) setShowGarageSugg(true) }}
                  onBlur={() => setTimeout(() => setShowGarageSugg(false), 150)}
                  placeholder="Rechercher un garage..." className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }} autoComplete="off" />
                {garageInput && (
                  <button type="button" onMouseDown={() => { setGarageInput(''); setShowGarageSugg(false) }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  </button>
                )}
              </div>
              {showGarageSugg && (() => {
                const q = garageInput.toLowerCase()
                const matches = garages.filter(g =>
                  g.name.toLowerCase().includes(q) || g.city.toLowerCase().includes(q) || g.code.toLowerCase().includes(q) || (g.region ?? '').toLowerCase().includes(q)
                )
                return matches.length > 0 ? (
                  <div className="absolute z-30 left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', maxHeight: 240 }}>
                    <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                      {matches.map(g => (
                        <button key={g.id} type="button"
                          onMouseDown={() => {
                            setSelectedGarage(g); setGarageInput(g.name)
                            setForm(f => ({ ...f, garage_id: g.id, zone: `${g.city}${g.region ? ' - ' + g.region : ''}` }))
                            setShowGarageSugg(false)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors">
                          <Wrench className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{g.name}</p>
                            <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <MapPin className="w-3 h-3" />{g.city}{g.region ? ` - ${g.region}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )}
        </div>

        {/* Zone */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Zone / Secteur</label>
          <input value={form.zone} onChange={set('zone')} placeholder="ex: Bouake - Vallee du Bandama" className={inputCls} style={inputStyle} />
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Date <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <input type="date" value={form.expense_date} onChange={set('expense_date')} className={inputCls} style={inputStyle} />
        </div>

        {/* Montant */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Montant (FCFA) <span style={{ color: '#DC2626' }}>*</span>
          </label>
          <div className="relative">
            <input type="number" min="0" step="500" value={form.amount} onChange={set('amount')} placeholder="0"
              className={inputCls + ' pr-16'} style={inputStyle} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>FCFA</span>
          </div>
          {form.amount && !isNaN(Number(form.amount)) && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#0B7439' }}>
              {new Intl.NumberFormat('fr-FR').format(Number(form.amount))} FCFA
            </p>
          )}
        </div>

        {/* Fournisseur */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Fournisseur</label>
          <input value={form.supplier} onChange={set('supplier')} placeholder="ex: CIE, SODECI..." className={inputCls} style={inputStyle} />
        </div>

        {/* Reference facture */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Reference facture</label>
          <input value={form.invoice_reference} onChange={set('invoice_reference')} placeholder="N de facture" className={inputCls} style={inputStyle} />
        </div>

        {/* Observation */}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Observation</label>
          <textarea value={form.observation} onChange={set('observation')} rows={2} placeholder="Notes complementaires..."
            className={inputCls} style={{ ...inputStyle, resize: 'none' as const }} />
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={() => save(false)} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#0B7439', color: '#fff' }}>
          <Save className="w-4 h-4" />{loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {!isEdit && (
          <button onClick={() => save(true)} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            <Plus className="w-4 h-4" />Enregistrer et ajouter une autre
          </button>
        )}
        <button onClick={() => navigate('/charge-achat/fixed-expenses')}
          className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Annuler
        </button>
      </div>
    </div>
  )
}
