import { useSeatMap } from '../../hooks/useSeatMap'
import { SeatMap } from '../../components/bus/SeatMap'

interface BusSeatMapViewProps {
  scheduleId: string
}

export function BusSeatMapView({ scheduleId }: BusSeatMapViewProps) {
  const { seatMap, isLoading, error } = useSeatMap({
    scheduleId,
    enableRealtime: true,
  })

  if (isLoading) return <div className="animate-pulse h-64 bg-gray-100 rounded-2xl" />
  if (error)     return <div className="text-[#AF3029] text-sm p-4">{error}</div>
  if (!seatMap)  return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-[#d4edda] rounded-xl p-3">
          <div className="text-2xl font-bold text-[#0B7439]">{seatMap.available_count}</div>
          <div className="text-xs text-[#4A6B55]">Disponibles</div>
        </div>
        <div className="bg-[#f8d7d5] rounded-xl p-3">
          <div className="text-2xl font-bold text-[#AF3029]">{seatMap.occupied_count}</div>
          <div className="text-xs text-[#4A6B55]">Occupés</div>
        </div>
        <div className="bg-[#FEF3C7] rounded-xl p-3">
          <div className="text-2xl font-bold text-[#D97706]">
            {seatMap.total_seats > 0
              ? Math.round((seatMap.occupied_count / seatMap.total_seats) * 100)
              : 0}%
          </div>
          <div className="text-xs text-[#4A6B55]">Taux remplissage</div>
        </div>
      </div>

      <SeatMap
        seatMap={seatMap}
        selectedSeats={[]}
        onSeatToggle={() => {}}
        showPassengerNames={true}
        maxSelectableSeats={0}
      />
    </div>
  )
}
