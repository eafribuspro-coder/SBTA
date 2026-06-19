import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Package, MapPin, CheckCircle2, Clock, Truck, PackageCheck, Search, ArrowRight, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '@/services/supabase'
import { fetchTrackingEvents } from '@/services/parcel.service'
import type { Parcel, ParcelTrackingEvent, ParcelStatus } from '@/types/parcel.types'

const STATUS_CONFIG: Record<ParcelStatus, { label: string; color: string; bg: string; pct: number }> = {
  enregistre:    { label: 'Enregistré',       color: '#0B7439', bg: '#d4edda', pct: 20 },
  mis_en_paquet: { label: 'Mis en paquet',    color: '#1D6FA4', bg: '#DBEAFE', pct: 40 },
  expedie:       { label: 'Expédié',          color: '#D97706', bg: '#FEF3C7', pct: 65 },
  arrive:        { label: 'Arrivé',           color: '#0B7439', bg: '#d4edda', pct: 85 },
  livre:         { label: 'Retiré',           color: '#0B7439', bg: '#d4edda', pct: 100 },
  retourne:      { label: 'Retourné',         color: '#92400E', bg: '#FEF3C7', pct: 0 },
  perdu:         { label: 'Perdu',            color: '#AF3029', bg: '#f8d7d5', pct: 0 },
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  enregistre:    <Package className="w-4 h-4" />,
  mis_en_paquet: <PackageCheck className="w-4 h-4" />,
  expedie:       <Truck className="w-4 h-4" />,
  arrive:        <MapPin className="w-4 h-4" />,
  livre:         <CheckCircle2 className="w-4 h-4" />,
}

export default function TrackParcel() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const [search, setSearch] = useState(code ?? '')
  const [parcel, setParcel] = useState<Parcel | null>(null)
  const [events, setEvents] = useState<ParcelTrackingEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function doSearch(c: string) {
    if (!c.trim()) return
    setLoading(true)
    setNotFound(false)
    setParcel(null)
    setEvents([])
    try {
      const { data, error } = await supabase
        .from('parcels')
        .select(`
          *,
          origin_station:stations!origin_station_id(id, name),
          dest_station:stations!destination_station_id(id, name)
        `)
        .or(`parcel_code.eq.${c.trim()},reference.eq.${c.trim()}`)
        .maybeSingle()

      if (error) throw error
      if (!data) { setNotFound(true); return }

      setParcel({
        ...data,
        origin_station_name: (data as any).origin_station?.name ?? '',
        destination_station_name: (data as any).dest_station?.name ?? '',
      })
      const evts = await fetchTrackingEvents(data.id)
      setEvents(evts)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (code) doSearch(code)
  }, [code])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/track/${search.trim()}`)
  }

  const sc = parcel ? STATUS_CONFIG[parcel.status] : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0faf4' }}>
      {/* Header */}
      <div className="py-4 px-4" style={{ backgroundColor: '#0B7439' }}>
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-green-200 hover:text-white text-sm mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Truck className="w-6 h-6 text-white" />
            <span className="text-white font-bold text-xl">SBTA — Suivi de courrier</span>
          </div>
          <p className="text-green-200 text-sm text-center">Entrez votre code de suivi pour localiser votre courrier</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-green-500"
            style={{ borderColor: '#D1D5DB', backgroundColor: '#fff', color: '#111827' }}
            placeholder="Code de suivi (ex: 184922)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-3 rounded-xl text-white font-semibold"
            style={{ backgroundColor: '#0B7439' }}
          >
            <Search className="w-5 h-5" />
          </button>
        </form>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#0B7439', borderTopColor: 'transparent' }} />
          </div>
        )}

        {notFound && (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}>
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: '#6B7280' }} />
            <p className="font-semibold" style={{ color: '#111827' }}>Courrier introuvable</p>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>Vérifiez votre code de suivi</p>
          </div>
        )}

        {parcel && sc && (
          <>
            {/* Code & Status */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>CODE</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: '#0B7439' }}>{parcel.parcel_code}</p>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>Réf : {parcel.reference}</p>
                </div>
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                  {sc.label}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1" style={{ color: '#9CA3AF' }}>
                  <span>Progression</span>
                  <span>{sc.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E5E7EB' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${sc.pct}%`, backgroundColor: sc.color }}
                  />
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold" style={{ color: '#111827' }}>{parcel.origin_station_name}</span>
                <div className="flex-1 flex items-center gap-1">
                  <div className="flex-1 border-t border-dashed" style={{ borderColor: '#D1D5DB' }} />
                  <ArrowRight className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                  <div className="flex-1 border-t border-dashed" style={{ borderColor: '#D1D5DB' }} />
                </div>
                <span className="font-semibold" style={{ color: '#111827' }}>{parcel.destination_station_name}</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}>
              <h2 className="font-semibold text-sm mb-4" style={{ color: '#111827' }}>Historique</h2>
              {events.length === 0 ? (
                <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun événement</p>
              ) : (
                <div className="space-y-3">
                  {events.map((evt, idx) => {
                    const esc = STATUS_CONFIG[evt.event_type as ParcelStatus] ?? { color: '#6B7280', bg: '#F3F4F6' }
                    const icon = STEP_ICONS[evt.event_type] ?? <Clock className="w-4 h-4" />
                    return (
                      <div key={evt.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: esc.bg, color: esc.color }}>
                            {icon}
                          </div>
                          {idx < events.length - 1 && <div className="w-0.5 flex-1 mt-1" style={{ backgroundColor: '#E5E7EB' }} />}
                        </div>
                        <div className="pb-3 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold" style={{ color: esc.color }}>{evt.description}</span>
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>
                              {format(new Date(evt.event_at), 'dd/MM HH:mm', { locale: fr })}
                            </span>
                          </div>
                          {evt.location && <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{evt.location}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Parcel info */}
            <div className="rounded-xl p-5" style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>EXPÉDITEUR</p>
                  <p className="font-medium" style={{ color: '#111827' }}>{parcel.sender_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>DESTINATAIRE</p>
                  <p className="font-medium" style={{ color: '#111827' }}>{parcel.recipient_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>DESTINATION</p>
                  <p className="font-medium" style={{ color: '#111827' }}>{parcel.recipient_city}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>CONTENU</p>
                  <p className="font-medium" style={{ color: '#111827' }}>{parcel.content_description}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
