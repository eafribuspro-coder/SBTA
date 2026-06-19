import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ScheduleReceiptSummary, CounterCharge, ChargeType } from '@/types/counter.types'
import { fetchScheduleCharges, createCounterCharge, checkChargeExists } from '@/services/counter.service'
import { CHARGE_LABELS } from '@/constants/charges'
import { supabase } from '@/services/supabase'

interface Props {
  schedule: ScheduleReceiptSummary
  onClose: () => void
}

const CHARGE_OPTIONS: { value: ChargeType; label: string; color: string; bg: string }[] = [
  { value: 'ration',               label: 'Ration',           color: '#D97706', bg: '#FEF3C7' },
  { value: 'carburant_complement', label: 'Carburant compl.', color: '#1D6FA4', bg: '#DBEAFE' },
  { value: 'peage',                label: 'Péage',            color: '#0B7439', bg: '#d4edda' },
  { value: 'autres',               label: 'Autres',           color: '#6B7280', bg: '#F3F4F6' },
]

const UNIQUE_CHARGE_TYPES: ChargeType[] = ['ration', 'carburant_complement', 'peage']

export default function ChargesModal({ schedule, onClose }: Props) {
  const [charges,     setCharges]     = useState<CounterCharge[]>([])
  const [loading,     setLoading]     = useState(true)
  const [chargeType,  setChargeType]  = useState<ChargeType | ''>('')
  const [description, setDescription] = useState('')
  const [amount,      setAmount]      = useState<number>(0)
  const [receiptFile, setReceiptFile] = useState<File | undefined>()
  const [submitting,  setSubmitting]  = useState(false)

  // IDs guichet/station réels (peut être null si schedule pas encore dans departure_sequence)
  const [myCounterId, setMyCounterId] = useState<string>(schedule.counter_id ?? '')
  const [myStationId, setMyStationId] = useState<string>(schedule.station_id ?? '')

  useEffect(() => {
    // Si counter_id manquant, charger depuis le profil guichetier
    if (!schedule.counter_id || !schedule.station_id) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase.from('counters').select('id, station_id').eq('assigned_user_id', user.id).maybeSingle().then(({ data }) => {
          if (data) { setMyCounterId(data.id); setMyStationId(data.station_id) }
        })
      })
    }
  }, [schedule.counter_id, schedule.station_id])

  useEffect(() => {
    fetchScheduleCharges(schedule.schedule_id)
      .then(setCharges)
      .catch(() => toast.error('Erreur chargement des charges'))
      .finally(() => setLoading(false))
  }, [schedule.schedule_id])

  const totalCharges = charges.reduce((s, c) => s + Number(c.amount), 0)
  const existingTypes = new Set(charges.map(c => c.charge_type))

  const handleAdd = async () => {
    if (!chargeType || !amount || amount <= 0) {
      toast.error('Type et montant requis')
      return
    }
    if (chargeType === 'autres' && !description.trim()) {
      toast.error('La description est obligatoire pour le type "Autres"')
      return
    }
    if (UNIQUE_CHARGE_TYPES.includes(chargeType as ChargeType) && existingTypes.has(chargeType)) {
      toast.error(`Les ${chargeType === 'ration' ? 'ratios' : chargeType === 'carburant_complement' ? 'compléments carburant' : 'péages'} de ce voyage ont déjà été enregistrés.`)
      return
    }
    setSubmitting(true)
    try {
      const newCharge = await createCounterCharge({
        schedule_id:  schedule.schedule_id,
        counter_id:   myCounterId,
        station_id:   myStationId,
        bus_id:       schedule.bus_id,
        charge_type:  chargeType,
        description:  description.trim(),
        amount,
        receipt_url:  receiptFile ? URL.createObjectURL(receiptFile) : undefined,
      })
      setCharges(prev => [...prev, newCharge])
      setChargeType('')
      setDescription('')
      setAmount(0)
      setReceiptFile(undefined)
      toast.success('Charge ajoutée')
    } catch (err: any) {
      console.error(err)
      toast.error('Erreur lors de l\'ajout')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2EAE5]">
          <div>
            <h2 className="font-bold text-[#1A2E22] text-base">
              Charges — {schedule.registration_number}
            </h2>
            <p className="text-xs text-[#8AA898] mt-0.5">
              Départ N°{schedule.departure_number ?? '—'} · {schedule.route_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F4F7F5] text-[#6B7280] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Liste des charges existantes */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#0B7439]" />
            </div>
          ) : charges.length === 0 ? (
            <div className="text-center py-8 text-[#8AA898] text-sm">
              Aucune charge saisie pour ce départ
            </div>
          ) : (
            <div className="space-y-2">
              {charges.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-[#F8FAF8] rounded-xl
                             px-4 py-3 border border-[#E2EAE5]"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1A2E22]">
                      {CHARGE_LABELS[c.charge_type] ?? c.charge_type}
                      {c.description && (
                        <span className="text-[#8AA898] font-normal ml-1">— {c.description}</span>
                      )}
                    </p>
                    <p className="text-xs text-[#8AA898] mt-0.5">
                      {new Date(c.created_at).toLocaleTimeString('fr-CI', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#AF3029] text-sm">
                      {Number(c.amount).toLocaleString('fr-CI')} FCFA
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'valide'
                        ? 'bg-[#d4edda] text-[#0B7439]'
                        : c.status === 'rejete'
                        ? 'bg-[#f8d7d5] text-[#AF3029]'
                        : 'bg-[#FEF3C7] text-[#D97706]'
                    }`}>
                      {c.status === 'valide' ? 'Validé' : c.status === 'rejete' ? 'Rejeté' : 'En attente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total charges */}
          {charges.length > 0 && (
            <div className="bg-white border border-[#E2EAE5] rounded-xl px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#4A6B55]">Total charges</span>
                <span className="font-bold text-[#AF3029]">
                  {totalCharges.toLocaleString('fr-CI')} FCFA
                </span>
              </div>
            </div>
          )}

          {/* Formulaire ajout */}
          <div className="border-t border-[#E2EAE5] pt-4 space-y-3">
            <h4 className="font-bold text-[#1A2E22] text-sm">Ajouter une charge</h4>

            {/* Sélection type */}
            <div className="grid grid-cols-4 gap-2">
              {CHARGE_OPTIONS.map(opt => {
                const alreadyUsed = UNIQUE_CHARGE_TYPES.includes(opt.value) && existingTypes.has(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => !alreadyUsed && setChargeType(opt.value)}
                    disabled={alreadyUsed}
                    className={`py-2.5 rounded-xl text-xs font-semibold border-2 transition-colors relative ${
                      alreadyUsed
                        ? 'border-[#E2EAE5] bg-[#F9FAFB] text-[#D1D5DB] cursor-not-allowed opacity-50'
                        : chargeType === opt.value
                        ? 'border-[#0B7439] bg-[#d4edda] text-[#0B7439]'
                        : 'border-[#E2EAE5] bg-white text-[#4A6B55] hover:border-[#0B7439]'
                    }`}
                    title={alreadyUsed ? `${opt.label} déjà enregistré` : ''}
                  >
                    {opt.label}
                    {alreadyUsed && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Warning if selected type already exists */}
            {chargeType && UNIQUE_CHARGE_TYPES.includes(chargeType as ChargeType) && existingTypes.has(chargeType) && (
              <div className="px-3 py-2 rounded-xl bg-[#FEF3C7] border border-[#FBBF24] text-[#92400E] text-xs font-medium">
                Les {chargeType === 'ration' ? 'ratios' : chargeType === 'carburant_complement' ? 'compléments carburant' : 'péages'} de ce voyage ont déjà été enregistrés.
              </div>
            )}

            {/* Description */}
            <input
              type="text"
              placeholder={chargeType === 'autres'
                ? 'Description de la charge (obligatoire) *'
                : 'Description (ex: Péage Singrobo, Ration chauffeur...)'}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full border rounded-xl px-4 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#0B7439] text-[#1A2E22]"
              style={{ borderColor: chargeType === 'autres' && !description.trim() ? '#FBBF24' : '#E2EAE5' }}
            />

            {/* Montant */}
            <div className="relative">
              <input
                type="number"
                min="0"
                step="500"
                placeholder="Montant"
                value={amount || ''}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full border border-[#E2EAE5] rounded-xl px-4 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-[#0B7439] pr-16 text-[#1A2E22]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8AA898]">
                FCFA
              </span>
            </div>

            {/* Justificatif */}
            <div>
              <label className="text-xs text-[#8AA898] block mb-1">Justificatif (optionnel)</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setReceiptFile(e.target.files?.[0])}
                className="block w-full text-xs text-[#6B7280] file:mr-3 file:py-1 file:px-3
                           file:rounded-lg file:border-0 file:text-xs file:font-medium
                           file:bg-[#F4F7F5] file:text-[#0B7439] hover:file:bg-[#d4edda]"
              />
            </div>

            {/* Bouton ajouter */}
            <button
              type="button"
              onClick={handleAdd}
              disabled={
                !chargeType || !amount || submitting ||
                (chargeType === 'autres' && !description.trim()) ||
                (UNIQUE_CHARGE_TYPES.includes(chargeType as ChargeType) && existingTypes.has(chargeType))
              }
              className="w-full bg-[#0B7439] hover:bg-[#085c2d] disabled:opacity-40
                         text-white font-bold rounded-xl h-11 transition-colors flex
                         items-center justify-center gap-2 text-sm"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</>
              ) : (
                'Ajouter la charge'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
