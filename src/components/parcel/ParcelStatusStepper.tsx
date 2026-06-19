import React from 'react'
import { Package, PackageCheck, Truck, MapPin, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react'
import type { ParcelStatus, Parcel } from '@/types/parcel.types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Step {
  key: ParcelStatus
  label: string
  labelShort: string
  icon: React.ReactNode
  color: string
  bg: string
  timestampKey: keyof Parcel
}

const WORKFLOW_STEPS: Step[] = [
  {
    key: 'enregistre',
    label: 'Enregistré',
    labelShort: 'Enreg.',
    icon: <Package className="w-4 h-4 sm:w-5 sm:h-5" />,
    color: '#0B7439',
    bg: '#d4edda',
    timestampKey: 'registered_at',
  },
  {
    key: 'mis_en_paquet',
    label: 'Mis en paquet',
    labelShort: 'Paquet',
    icon: <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />,
    color: '#1D6FA4',
    bg: '#DBEAFE',
    timestampKey: 'packaged_at',
  },
  {
    key: 'expedie',
    label: 'Expédié',
    labelShort: 'Expédié',
    icon: <Truck className="w-4 h-4 sm:w-5 sm:h-5" />,
    color: '#D97706',
    bg: '#FEF3C7',
    timestampKey: 'shipped_at',
  },
  {
    key: 'arrive',
    label: 'Arrivé',
    labelShort: 'Arrivé',
    icon: <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />,
    color: '#0B7439',
    bg: '#d4edda',
    timestampKey: 'arrived_at',
  },
]

const STATUS_ORDER: ParcelStatus[] = ['enregistre', 'mis_en_paquet', 'expedie', 'arrive', 'livre']

function getStepIndex(status: ParcelStatus): number {
  return STATUS_ORDER.indexOf(status)
}

interface Props {
  parcel: Parcel
  onAdvance?: (newStatus: ParcelStatus) => void
  canAdvance?: boolean
  loading?: boolean
}

const NEXT_STATUS: Partial<Record<ParcelStatus, ParcelStatus>> = {
  enregistre:    'mis_en_paquet',
  mis_en_paquet: 'expedie',
  expedie:       'arrive',
  arrive:        'livre',
}

const ACTION_LABELS: Partial<Record<ParcelStatus, string>> = {
  enregistre:    'Mettre en paquet',
  mis_en_paquet: 'Marquer Expédié',
  expedie:       'Confirmer Arrivée',
  arrive:        'Confirmer Retrait',
}

export default function ParcelStatusStepper({ parcel, onAdvance, canAdvance = false, loading = false }: Props) {
  const currentIdx = getStepIndex(parcel.status)
  const isTerminal = parcel.status === 'livre' || parcel.status === 'retourne' || parcel.status === 'perdu'
  const nextStatus = NEXT_STATUS[parcel.status]

  function fmtDate(ts: string | null): string {
    if (!ts) return ''
    return format(new Date(ts), 'dd/MM HH:mm', { locale: fr })
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Steps bar — adapté mobile */}
      <div className="flex items-start gap-0 overflow-x-auto pb-1">
        {WORKFLOW_STEPS.map((step, idx) => {
          const done = idx <= currentIdx
          const active = idx === currentIdx
          const isLast = idx === WORKFLOW_STEPS.length - 1
          const ts = parcel[step.timestampKey] as string | null

          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative min-w-[60px]">
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute top-4 sm:top-5 left-1/2 w-full h-0.5"
                  style={{ backgroundColor: idx < currentIdx ? step.color : '#E5E7EB', zIndex: 0 }}
                />
              )}

              {/* Circle */}
              <div
                className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0"
                style={{
                  backgroundColor: done ? step.bg : '#F9FAFB',
                  borderColor: done ? step.color : '#D1D5DB',
                  color: done ? step.color : '#9CA3AF',
                }}
              >
                {done && !active
                  ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: step.color }} />
                  : step.icon}
              </div>

              {/* Label — court sur mobile */}
              <p
                className="mt-1.5 sm:mt-2 text-xs text-center font-medium leading-tight px-0.5 sm:px-1"
                style={{ color: done ? step.color : '#9CA3AF' }}
              >
                <span className="sm:hidden">{step.labelShort}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </p>

              {/* Timestamp */}
              <p className="text-xs text-center mt-0.5 hidden sm:block" style={{ color: '#6B7280' }}>
                {done && ts ? fmtDate(ts) : <span style={{ color: '#D1D5DB' }}>En attente</span>}
              </p>
            </div>
          )
        })}
      </div>

      {/* Special statuses */}
      {parcel.status === 'livre' && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg" style={{ backgroundColor: '#d4edda' }}>
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: '#0B7439' }} />
          <span className="text-xs sm:text-sm font-semibold" style={{ color: '#0B7439' }}>
            Courrier retiré le {parcel.delivered_at ? fmtDate(parcel.delivered_at) : '—'}
          </span>
        </div>
      )}
      {parcel.status === 'retourne' && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg" style={{ backgroundColor: '#FEF3C7' }}>
          <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: '#92400E' }} />
          <span className="text-xs sm:text-sm font-semibold" style={{ color: '#92400E' }}>Courrier retourné à l'expéditeur</span>
        </div>
      )}
      {parcel.status === 'perdu' && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg" style={{ backgroundColor: '#f8d7d5' }}>
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: '#AF3029' }} />
          <span className="text-xs sm:text-sm font-semibold" style={{ color: '#AF3029' }}>Courrier déclaré perdu</span>
        </div>
      )}

      {/* Action button */}
      {canAdvance && !isTerminal && nextStatus && onAdvance && (
        <button
          onClick={() => onAdvance(nextStatus)}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0B7439', color: '#fff' }}
        >
          {loading ? 'Mise à jour...' : ACTION_LABELS[parcel.status]}
        </button>
      )}
    </div>
  )
}
