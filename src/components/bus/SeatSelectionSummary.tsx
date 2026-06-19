import { X, Armchair, ChevronRight } from 'lucide-react'
import type { EnrichedSeat } from '../../types/seatMap.types'

interface SeatSelectionSummaryProps {
  selectedSeats: EnrichedSeat[]
  totalPrice: number
  onRemoveSeat: (seatId: string) => void
  onConfirm: () => void
  onClear: () => void
  isSubmitting?: boolean
  pricePerSeat?: number
  tripLabel?: string
}

export function SeatSelectionSummary({
  selectedSeats,
  totalPrice,
  onRemoveSeat,
  onConfirm,
  onClear,
  isSubmitting = false,
  pricePerSeat,
  tripLabel,
}: SeatSelectionSummaryProps) {
  if (selectedSeats.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center">
          <Armchair className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600">Aucun siège sélectionné</p>
          <p className="text-xs text-slate-400 mt-0.5">Cliquez sur un siège disponible pour le choisir</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#0B7439] flex items-center justify-center">
            <span className="text-white text-[11px] font-bold">{selectedSeats.length}</span>
          </div>
          <span className="text-sm font-bold text-slate-800">
            {selectedSeats.length === 1 ? 'Siège sélectionné' : 'Sièges sélectionnés'}
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
          Effacer tout
        </button>
      </div>

      {tripLabel && (
        <div className="px-4 py-2 border-b border-slate-100 text-xs text-slate-500 flex items-center gap-1">
          <ChevronRight className="w-3 h-3" />
          {tripLabel}
        </div>
      )}

      <div className="p-4 space-y-2">
        {selectedSeats.map(seat => (
          <div
            key={seat.id}
            className="flex items-center justify-between bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0B7439] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{seat.label}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Siège {seat.label}
                  {seat.type === 'vip' && (
                    <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">VIP</span>
                  )}
                  {seat.type === 'handicape' && (
                    <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">PMR</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{seat.price.toLocaleString('fr-CI')} FCFA</p>
              </div>
            </div>
            <button
              onClick={() => onRemoveSeat(seat.id)}
              className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition-colors group"
            >
              <X size={12} className="text-slate-400 group-hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between py-3 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500">Total à payer</p>
            {pricePerSeat && selectedSeats.length > 1 && (
              <p className="text-[10px] text-slate-400">{selectedSeats.length} × {pricePerSeat.toLocaleString('fr-CI')} FCFA</p>
            )}
          </div>
          <span className="text-xl font-black text-[#0B7439]">
            {totalPrice.toLocaleString('fr-CI')} <span className="text-sm font-semibold text-slate-500">FCFA</span>
          </span>
        </div>

        <button
          onClick={onConfirm}
          disabled={isSubmitting || selectedSeats.length === 0}
          className="w-full bg-[#0B7439] hover:bg-[#085c2d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl h-12 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Confirmation en cours...
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4" />
              Confirmer {selectedSeats.length === 1 ? 'le siège' : `les ${selectedSeats.length} sièges`}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
