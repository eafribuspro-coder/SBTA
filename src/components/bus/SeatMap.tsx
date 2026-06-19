import { memo, useMemo } from 'react'
import type { EnrichedSeat, EnrichedRow, ScheduleSeatMap } from '../../types/seatMap.types'

interface SeatMapProps {
  seatMap: ScheduleSeatMap
  selectedSeats: EnrichedSeat[]
  onSeatToggle: (seat: EnrichedSeat) => void
  showPassengerNames?: boolean
  maxSelectableSeats?: number
  lockCountdowns?: Record<string, number>
}

const Seat = memo(({
  seat,
  isSelected,
  onSelect,
  showPassengerName = false,
  lockCountdown,
}: {
  seat: EnrichedSeat
  isSelected: boolean
  onSelect: (seat: EnrichedSeat) => void
  showPassengerName?: boolean
  lockCountdown?: number
}) => {
  const status = isSelected ? 'selected' : seat.status

  const getStyle = (): string => {
    switch (status) {
      case 'selected':
        return 'bg-[#0B7439] border-[#085c2d] text-white ring-2 ring-[#0B7439] ring-offset-1 shadow-lg scale-105 cursor-pointer'
      case 'occupied':
        return 'bg-[#F1F5F9] border-[#CBD5E1] text-[#94A3B8] cursor-not-allowed'
      case 'out_of_service':
        return 'bg-[#F8FAFC] border-[#E2E8F0] text-[#CBD5E1] cursor-not-allowed'
      case 'boarding':
        return 'bg-[#DBEAFE] border-[#93C5FD] text-[#3B82F6] cursor-not-allowed'
      case 'my_reservation':
        return 'bg-[#EDE9FE] border-[#C4B5FD] text-[#7C3AED] cursor-not-allowed'
      case 'locked':
        return 'bg-[#FFF7ED] border-[#FDBA74] text-[#EA580C] cursor-not-allowed'
      case 'locked_by_me':
        return 'bg-[#0B7439] border-[#085c2d] text-white ring-2 ring-[#0B7439] ring-offset-1 shadow-lg cursor-pointer animate-pulse'
      default:
        return seat.type === 'vip'
          ? 'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E] hover:bg-[#FEF3C7] hover:scale-105 cursor-pointer active:scale-95 transition-all'
          : 'bg-white border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] hover:border-[#0B7439] hover:text-[#0B7439] hover:scale-105 cursor-pointer active:scale-95 transition-all'
    }
  }

  const getContent = () => {
    if (status === 'locked') {
      return <span className="text-[9px] font-bold leading-none">🔒</span>
    }
    if (status === 'locked_by_me') {
      return (
        <>
          <span className="text-[11px] font-bold leading-none">{seat.label}</span>
          {lockCountdown !== undefined && (
            <span className="text-[8px] leading-none opacity-80">{lockCountdown}s</span>
          )}
        </>
      )
    }
    if (status === 'occupied') {
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-40">
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )
    }
    if (status === 'out_of_service') {
      return <span className="text-[9px] font-bold leading-none">×</span>
    }
    return (
      <>
        {seat.type === 'vip' && <span className="text-[8px] leading-none mb-0.5">★</span>}
        {seat.type === 'handicape' && <span className="text-[8px] leading-none mb-0.5">♿</span>}
        <span className="text-[11px] font-bold leading-none">{seat.label}</span>
      </>
    )
  }

  const tooltip = () => {
    if (isSelected) return `Siège ${seat.label} — Cliquer pour désélectionner`
    switch (seat.status) {
      case 'available':
        return `Siège ${seat.label} — ${seat.price.toLocaleString('fr-CI')} FCFA${seat.type === 'vip' ? ' (VIP)' : ''}`
      case 'occupied':
        return showPassengerName && seat.passenger_name
          ? `Occupé — ${seat.passenger_name}`
          : `Siège ${seat.label} — Occupé`
      case 'out_of_service': return `Siège ${seat.label} — Hors service`
      case 'boarding': return `Siège ${seat.label} — En cours d'embarquement`
      case 'my_reservation': return `Siège ${seat.label} — Votre réservation`
      case 'locked': return `Siège ${seat.label} — Verrouillé temporairement par un autre guichet`
      case 'locked_by_me': return `Siège ${seat.label} — Verrouillé par vous (${lockCountdown ?? 0}s restantes)`
      default: return `Siège ${seat.label}`
    }
  }

  const isDisabled = status !== 'available' && status !== 'selected' && status !== 'locked_by_me'

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onSelect(seat)}
      disabled={isDisabled}
      title={tooltip()}
      aria-label={`Siège ${seat.label}`}
      aria-pressed={isSelected || status === 'locked_by_me'}
      className={[
        'relative flex flex-col items-center justify-center rounded-md border-2 select-none transition-all duration-150',
        'w-10 h-11',
        getStyle(),
      ].join(' ')}
    >
      {getContent()}
      {showPassengerName && seat.passenger_name && seat.status === 'occupied' && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded z-10 pointer-events-none opacity-0 group-hover:opacity-100">
          {seat.passenger_name}
        </div>
      )}
    </button>
  )
})
Seat.displayName = 'Seat'

const SEAT_W = 40
const SEAT_GAP = 4
const AISLE_W = 20

function calcBusBodyWidth(leftCols: number, rightCols: number): number {
  return (
    leftCols * SEAT_W + (leftCols - 1) * SEAT_GAP +
    AISLE_W +
    rightCols * SEAT_W + Math.max(0, rightCols - 1) * SEAT_GAP
  )
}

export function SeatMap({
  seatMap,
  selectedSeats,
  onSeatToggle,
  showPassengerNames = false,
  maxSelectableSeats = 1,
  lockCountdowns = {},
}: SeatMapProps) {
  const selectedIds = useMemo(
    () => new Set(selectedSeats.map(s => s.id)),
    [selectedSeats]
  )

  const handleSeatSelect = (seat: EnrichedSeat) => {
    if (seat.status !== 'available' && seat.status !== 'locked_by_me') return
    const isSelected = selectedIds.has(seat.id)
    if (!isSelected && maxSelectableSeats > 0 && selectedSeats.length >= maxSelectableSeats) return
    onSeatToggle(seat)
  }

  const { config, enriched_layout } = seatMap
  const fillPct = seatMap.total_seats > 0
    ? Math.round((seatMap.occupied_count / seatMap.total_seats) * 100)
    : 0

  const leftCols = config.columns_left ?? 2
  const rightCols = config.columns_right ?? 2
  const bodyWidth = calcBusBodyWidth(leftCols, rightCols)

  const normalRows = enriched_layout.filter(r => r.seats.some(s => s.side !== 'back'))
  const backRows = enriched_layout.filter(r => r.seats.every(s => s.side === 'back'))

  return (
    <div className="flex flex-col items-center gap-4 w-full">

      <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 truncate">{config.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {seatMap.bus_registration || 'N/A'} · {seatMap.bus_class.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div className="text-center">
              <div className="font-bold text-[#0B7439] text-base leading-none">{seatMap.available_count}</div>
              <div className="text-slate-400 mt-0.5">Libres</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-500 text-base leading-none">{seatMap.occupied_count}</div>
              <div className="text-slate-400 mt-0.5">Occupés</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-slate-700 text-base leading-none">{fillPct}%</div>
              <div className="text-slate-400 mt-0.5">Rempli</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-white border-b border-slate-100">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${fillPct}%`,
                backgroundColor: fillPct >= 90 ? '#EF4444' : fillPct >= 70 ? '#F59E0B' : '#0B7439',
              }}
            />
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <div className="flex flex-col items-center gap-1.5" style={{ minWidth: bodyWidth + 32 }}>

            <div
              className="flex items-center justify-center gap-2 bg-slate-800 rounded-xl py-2 px-4 mb-1"
              style={{ width: bodyWidth + 8 }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-slate-300 flex-shrink-0" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20v-2a8 8 0 0 1 16 0v2" />
              </svg>
              <span className="text-white text-xs font-semibold tracking-wide">CONDUCTEUR · AVANT</span>
            </div>

            <div className="flex flex-col gap-1" style={{ width: bodyWidth + 32 }}>
              {normalRows.map((row: EnrichedRow) => {
                const leftSeats = row.seats.filter(s => s.side === 'left')
                const rightSeats = row.seats.filter(s => s.side === 'right')

                const leftW = leftCols * SEAT_W + Math.max(0, leftCols - 1) * SEAT_GAP
                const rightW = rightCols * SEAT_W + Math.max(0, rightCols - 1) * SEAT_GAP

                return (
                  <div key={`row-${row.row}`} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium w-5 text-right flex-shrink-0">
                      {row.row}
                    </span>
                    <div className="flex items-center" style={{ gap: 0 }}>
                      <div
                        className="flex items-center gap-[4px]"
                        style={{ width: leftW }}
                      >
                        {leftSeats.map(seat => (
                          <Seat
                            key={seat.id}
                            seat={seat}
                            isSelected={selectedIds.has(seat.id)}
                            onSelect={handleSeatSelect}
                            showPassengerName={showPassengerNames}
                            lockCountdown={lockCountdowns[seat.id]}
                          />
                        ))}
                        {leftSeats.length < leftCols && Array.from({ length: leftCols - leftSeats.length }).map((_, i) => (
                          <div key={`empty-l-${i}`} className="w-10 h-11 flex-shrink-0" />
                        ))}
                      </div>

                      <div
                        className="flex items-center justify-center flex-shrink-0"
                        style={{ width: AISLE_W }}
                      >
                        <div className="w-px h-8 bg-slate-200" />
                      </div>

                      <div
                        className="flex items-center gap-[4px]"
                        style={{ width: rightW }}
                      >
                        {rightSeats.map(seat => (
                          <Seat
                            key={seat.id}
                            seat={seat}
                            isSelected={selectedIds.has(seat.id)}
                            onSelect={handleSeatSelect}
                            showPassengerName={showPassengerNames}
                            lockCountdown={lockCountdowns[seat.id]}
                          />
                        ))}
                        {rightSeats.length < rightCols && Array.from({ length: rightCols - rightSeats.length }).map((_, i) => (
                          <div key={`empty-r-${i}`} className="w-10 h-11 flex-shrink-0" />
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {backRows.length > 0 && (
              <>
                <div
                  className="flex items-center gap-2 my-1"
                  style={{ width: bodyWidth + 32 }}
                >
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                  <span className="text-[9px] text-slate-400 tracking-widest font-medium">BANQUETTE ARRIÈRE</span>
                  <div className="flex-1 border-t border-dashed border-slate-200" />
                </div>
                {backRows.map((row: EnrichedRow) => (
                  <div key={`back-${row.row}`} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium w-5 text-right flex-shrink-0">
                      {row.row}
                    </span>
                    <div className="flex gap-[4px]">
                      {row.seats.filter(s => s.side === 'back').map(seat => (
                        <Seat
                          key={seat.id}
                          seat={seat}
                          isSelected={selectedIds.has(seat.id)}
                          onSelect={handleSeatSelect}
                          showPassengerName={showPassengerNames}
                          lockCountdown={lockCountdowns[seat.id]}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div
              className="flex items-center justify-center bg-slate-700 rounded-xl py-2 px-4 mt-1"
              style={{ width: bodyWidth + 8 }}
            >
              <span className="text-slate-300 text-[10px] font-semibold tracking-widest">ARRIÈRE DU BUS</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] justify-center">
          {[
            { color: 'bg-white border-slate-300', label: 'Disponible' },
            { color: 'bg-[#0B7439] border-[#085c2d]', label: 'Sélectionné', textColor: 'text-white' },
            { color: 'bg-[#F1F5F9] border-[#CBD5E1]', label: 'Occupé' },
            { color: 'bg-[#FFFBEB] border-[#FCD34D]', label: 'VIP', icon: '★' },
            { color: 'bg-[#DBEAFE] border-[#93C5FD]', label: 'Embarqué', textColor: 'text-blue-600' },
            { color: 'bg-[#FFF7ED] border-[#FDBA74]', label: 'Verrouillé', textColor: 'text-orange-600', icon: '🔒' },
            { color: 'bg-slate-50 border-slate-200', label: 'Hors service' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                {item.icon && <span className={`text-[8px] ${item.textColor ?? 'text-amber-700'}`}>{item.icon}</span>}
              </div>
              <span className="text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
