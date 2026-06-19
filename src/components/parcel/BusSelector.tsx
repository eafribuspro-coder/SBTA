import React, { useState, useEffect } from 'react'
import { Bus, Clock, User, Building2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase } from '@/services/supabase'
import { format, differenceInMinutes, addMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface ScheduledBus {
  id: string
  departure_datetime: string
  arrival_datetime: string | null
  estimated_duration_minutes: number | null
  route_name: string | null
  status: string
  seats_available: number | null
  seats_reserved: number | null
  registration_number: string
  brand: string | null
  model: string | null
  total_seats: number | null
  company_name: string | null
  driver_name: string | null
  departure_station_id: string
  arrival_station_id: string
}

interface Props {
  originStationId: string
  destinationStationId: string
  value: string
  onChange: (scheduleId: string, bus: ScheduledBus | null) => void
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` : `${m}min`
}

export default function BusSelector({ originStationId, destinationStationId, value, onChange }: Props) {
  const [buses, setBuses] = useState<ScheduledBus[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const selected = buses.find(b => b.id === value) ?? null

  function mapBus(s: any): ScheduledBus {
    return {
      id: s.id,
      departure_datetime: s.departure_datetime,
      arrival_datetime: s.arrival_datetime,
      estimated_duration_minutes: s.estimated_duration_minutes,
      route_name: s.route_name,
      status: s.status,
      seats_available: s.seats_available,
      seats_reserved: s.seats_reserved,
      registration_number: s.buses?.registration_number ?? '—',
      brand: s.buses?.brand ?? null,
      model: s.buses?.model ?? null,
      total_seats: s.buses?.total_seats ?? null,
      company_name: s.buses?.companies?.name ?? null,
      driver_name: s.users?.full_name ?? null,
      departure_station_id: s.departure_station_id,
      arrival_station_id: s.arrival_station_id,
    }
  }

  async function fetchBuses() {
    setLoading(true)
    const now = new Date().toISOString()
    try {
      const { data } = await supabase
        .from('schedules')
        .select(`
          id, departure_datetime, arrival_datetime, estimated_duration_minutes,
          route_name, status, seats_available, seats_reserved,
          departure_station_id, arrival_station_id, transit_stops,
          buses!bus_id(registration_number, brand, model, total_seats, companies(name)),
          users!driver_id(full_name)
        `)
        .eq('departure_station_id', originStationId)
        .gte('departure_datetime', now)
        .in('status', ['planifie', 'en_cours'])
        .order('departure_datetime', { ascending: true })

      const filtered = (data ?? []).filter((s: any) =>
        s.arrival_station_id === destinationStationId ||
        (s.transit_stops ?? []).some((stop: any) => stop.station_id === destinationStationId)
      )
      setBuses(filtered.map(mapBus))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!originStationId || !destinationStationId) { setBuses([]); return }
    let cancelled = false
    fetchBuses().finally(() => { if (cancelled) setBuses([]) })
    return () => { cancelled = true }
  }, [originStationId, destinationStationId])

  function selectBus(bus: ScheduledBus | null) {
    setExpanded(false)
    onChange(bus?.id ?? '', bus)
  }

  const depTime = selected ? new Date(selected.departure_datetime) : null
  const estArrival = selected
    ? selected.arrival_datetime
      ? new Date(selected.arrival_datetime)
      : selected.estimated_duration_minutes
        ? addMinutes(new Date(selected.departure_datetime), selected.estimated_duration_minutes)
        : null
    : null
  const duration = depTime && estArrival ? differenceInMinutes(estArrival, depTime) : selected?.estimated_duration_minutes ?? null

  if (!originStationId || !destinationStationId) return null

  return (
    <div className="col-span-1 sm:col-span-2 space-y-2 sm:space-y-3">
      {/* Label + actualiser */}
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Bus d'acheminement
        </label>
        <button
          type="button"
          onClick={fetchBuses}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
          style={{ color: '#1D6FA4', backgroundColor: '#EFF6FF' }}
        >
          <RefreshCw className="w-3 h-3" />
          Actualiser
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-subtle)' }}>
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Recherche des bus disponibles...</span>
        </div>
      )}

      {/* Aucun bus */}
      {!loading && buses.length === 0 && (
        <div className="flex items-start gap-3 px-3 sm:px-4 py-3 rounded-xl" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#D97706' }} />
          <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
            Aucun bus planifié disponible pour cette destination.
            Le courrier sera acheminé lors du prochain départ disponible.
          </p>
        </div>
      )}

      {/* Sélecteur */}
      {!loading && buses.length > 0 && (
        <div className="space-y-2">
          {/* Trigger */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors"
            style={{
              borderColor: selected ? '#0B7439' : 'var(--border)',
              backgroundColor: selected ? '#f0faf4' : 'var(--surface)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Bus className="w-4 h-4 flex-shrink-0" style={{ color: selected ? '#0B7439' : 'var(--text-muted)' }} />
              {selected ? (
                <span className="font-semibold truncate text-sm" style={{ color: '#0B7439' }}>
                  {selected.registration_number} — {selected.route_name ?? 'Voyage'}
                </span>
              ) : (
                <span className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                  Sélectionner un bus ({buses.length} disponible{buses.length > 1 ? 's' : ''})
                </span>
              )}
            </div>
            {expanded
              ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />}
          </button>

          {/* Dropdown */}
          {expanded && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
              {/* Option aucun */}
              <button
                type="button"
                onClick={() => selectBus(null)}
                className="w-full flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs hover:bg-gray-50 border-b transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <span className="italic">-- Aucun bus (acheminement manuel) --</span>
              </button>

              {buses.map(bus => {
                const dep = new Date(bus.departure_datetime)
                const arrTime = bus.arrival_datetime
                  ? new Date(bus.arrival_datetime)
                  : bus.estimated_duration_minutes
                    ? addMinutes(dep, bus.estimated_duration_minutes)
                    : null
                const dur = arrTime ? differenceInMinutes(arrTime, dep) : bus.estimated_duration_minutes
                const isSelected = bus.id === value

                return (
                  <button
                    key={bus.id}
                    type="button"
                    onClick={() => selectBus(bus)}
                    className="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50 border-b last:border-0 transition-colors"
                    style={{ borderColor: 'var(--border)', backgroundColor: isSelected ? '#f0faf4' : undefined }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* Immat + compagnie */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm font-mono" style={{ color: '#0B7439' }}>
                            {bus.registration_number}
                          </span>
                          {bus.company_name && (
                            <span className="text-xs flex items-center gap-1" style={{ color: '#1D6FA4' }}>
                              <Building2 className="w-3 h-3" />
                              {bus.company_name}
                            </span>
                          )}
                        </div>

                        {/* Chauffeur + places */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {bus.driver_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate max-w-[120px]">{bus.driver_name}</span>
                            </span>
                          )}
                          {bus.total_seats != null && (
                            <span className="flex items-center gap-1">
                              <Bus className="w-3 h-3 flex-shrink-0" />
                              {bus.seats_available ?? '—'}/{bus.total_seats} places
                            </span>
                          )}
                        </div>

                        {/* Horaires */}
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap text-xs">
                          <span className="flex items-center gap-1 font-medium" style={{ color: '#0B7439' }}>
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            {format(dep, 'dd/MM HH:mm', { locale: fr })}
                          </span>
                          {arrTime && (
                            <span style={{ color: '#D97706' }}>
                              → {format(arrTime, 'HH:mm', { locale: fr })}
                            </span>
                          )}
                          {dur && (
                            <span style={{ color: 'var(--text-muted)' }}>
                              {fmtDuration(dur)}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5" style={{ color: '#0B7439' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Résumé acheminement */}
      {selected && depTime && (
        <div className="rounded-xl p-3 sm:p-4 space-y-2" style={{ backgroundColor: '#f0faf4', border: '1px solid #86efac' }}>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0B7439' }}>
            Acheminement prévu
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="text-center">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-muted)' }}>Départ</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: '#0B7439' }}>
                {format(depTime, 'HH:mm', { locale: fr })}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {format(depTime, 'dd/MM', { locale: fr })}
              </p>
            </div>
            <div className="text-center border-x" style={{ borderColor: '#86efac' }}>
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-muted)' }}>Durée</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: '#1D6FA4' }}>
                {duration ? fmtDuration(duration) : '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>estimé</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-muted)' }}>Arrivée</p>
              <p className="text-xs sm:text-sm font-bold mt-0.5" style={{ color: '#D97706' }}>
                {estArrival ? format(estArrival, 'HH:mm', { locale: fr }) : '—'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {estArrival ? format(estArrival, 'dd/MM', { locale: fr }) : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
