import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Plus, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase } from '../../services/supabase'
import { fetchQuotesByGarage } from '../../services/garage.service'
import { useAuthStore } from '../../store/authStore'
import { formatCurrency } from '../../utils/formatCurrency'
import type { MaintenanceQuote } from '../../types/garage.types'

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  brouillon:        { label: 'Brouillon',  bg: '#F3F4F6', color: '#6B7280' },
  soumis_comptable: { label: 'Soumis',     bg: '#FEF3C7', color: '#D97706' },
  valide:           { label: 'Validé',     bg: '#DCFCE7', color: '#16A34A' },
  rejete:           { label: 'Rejeté',     bg: '#FEE2E2', color: '#DC2626' },
  converti_en_ot:   { label: 'OT créé',    bg: '#DBEAFE', color: '#2563EB' },
  annule:           { label: 'Annulé',     bg: '#F9FAFB', color: '#9CA3AF' },
}

export default function QuotesList() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [quotes, setQuotes]       = useState<MaintenanceQuote[]>([])
  const [loading, setLoading]     = useState(true)
  const [garageId, setGarageId]   = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')

  const loadGarageAndQuotes = useCallback(async () => {
    if (!user) return
    try {
      const { data: staffData } = await supabase
        .from('garage_staff')
        .select('garage_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      if (!staffData?.garage_id) return
      setGarageId(staffData.garage_id)
      const data = await fetchQuotesByGarage(staffData.garage_id)
      setQuotes(data)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadGarageAndQuotes() }, [loadGarageAndQuotes])

  // Realtime — quote validated or rejected
  useEffect(() => {
    if (!garageId) return
    const channel = supabase
      .channel(`quotes-garage-${garageId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'maintenance_quotes',
        filter: `garage_id=eq.${garageId}`,
      }, (payload) => {
        const n = payload.new as any
        if (n.status === 'valide') {
          toast.success(`Devis ${n.quote_number} validé — OT créé automatiquement !`, { duration: 6000 })
        }
        if (n.status === 'rejete') {
          toast.error(`Devis ${n.quote_number} rejeté — ${n.rejection_reason ?? ''}`, { duration: 8000 })
        }
        loadGarageAndQuotes()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [garageId, loadGarageAndQuotes])

  const filtered = quotes.filter(q => !statusFilter || q.status === statusFilter)

  if (loading) return <div className="p-8">Chargement...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A2E22' }}>Mes devis</h1>
        <button
          onClick={() => navigate('/garage/quotes/new')}
          className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
          style={{ backgroundColor: '#0B7439' }}
        >
          <Plus className="w-4 h-4" /> Nouveau devis
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          ['', 'Tous', quotes.length],
          ['brouillon', 'Brouillons', quotes.filter(q => q.status === 'brouillon').length],
          ['soumis_comptable', 'Soumis', quotes.filter(q => q.status === 'soumis_comptable').length],
          ['valide', 'Validés', quotes.filter(q => q.status === 'valide').length],
          ['rejete', 'Rejetés', quotes.filter(q => q.status === 'rejete').length],
          ['converti_en_ot', 'OT créés', quotes.filter(q => q.status === 'converti_en_ot').length],
        ].map(([v, label, count]) => (
          <button key={v as string} onClick={() => setStatusFilter(v as string)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              backgroundColor: statusFilter === v ? '#0B7439' : '#F4F7F5',
              color:           statusFilter === v ? '#fff'    : '#4A6B55',
            }}>
            {label} ({count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border" style={{ borderColor: '#E2EAE5' }}>
          <ClipboardList className="w-12 h-12 mx-auto mb-3" style={{ color: '#D1DFD6' }} />
          <p className="mb-4" style={{ color: '#9AB4A0' }}>Aucun devis trouvé</p>
          <button onClick={() => navigate('/garage/quotes/new')}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: '#0B7439' }}>
            Créer un premier devis
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E2EAE5' }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F4F7F5' }}>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>N° Devis</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Bus</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Société</th>
                <th className="text-right px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Montant</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Statut</th>
                <th className="text-left px-4 py-3 text-sm font-semibold" style={{ color: '#4A6B55' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const sts = STATUS_CFG[q.status] ?? STATUS_CFG.brouillon
                return (
                  <tr key={q.id} className="border-t hover:bg-gray-50" style={{ borderColor: '#E2EAE5' }}>
                    <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color: '#0B7439' }}>{q.quote_number}</td>
                    <td className="px-4 py-3 font-semibold text-sm" style={{ color: '#1A2E22' }}>{q.bus_registration}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F0FBF4', color: '#0B7439' }}>
                        {q.bus_company_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: '#1A2E22' }}>
                      {formatCurrency(q.total_estimated_cost)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: sts.bg, color: sts.color }}>
                        {sts.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#4A6B55' }}>
                      {format(new Date(q.created_at), 'dd/MM/yyyy', { locale: fr })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
