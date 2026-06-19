import { useEffect, useState } from 'react'
import { Settings, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'

export default function RHSettings() {
  const { user } = useAuthStore()
  const [settingsId,       setSettingsId]       = useState<string | null>(null)
  const [thresholdMonths,  setThresholdMonths]  = useState(6)
  const [requiresHrVal,    setRequiresHrVal]    = useState(true)
  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)

  useEffect(() => {
    supabase.from('seniority_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id)
          setThresholdMonths(data.seniority_threshold_months)
          setRequiresHrVal(data.requires_hr_validation)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        seniority_threshold_months: thresholdMonths,
        requires_hr_validation:     requiresHrVal,
        updated_by:                 user?.id ?? null,
        updated_at:                 new Date().toISOString(),
      }
      if (settingsId) {
        const { error } = await supabase.from('seniority_settings').update(payload).eq('id', settingsId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('seniority_settings').insert(payload).select().maybeSingle()
        if (error) throw error
        if (data) setSettingsId(data.id)
      }
      toast.success('Paramètres enregistrés')
    } catch {
      toast.error('Erreur lors de l\'enregistrement')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0B7439] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2E22]">Paramètres RH</h1>
        <p className="text-sm text-[#6B7280] mt-1">Configuration du module Ressources Humaines</p>
      </div>

      {/* Seniority threshold */}
      <div className="bg-white border border-[#E2EAE5] rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-[#0B7439]" />
          <h3 className="font-bold text-[#1A2E22]">Paramètres de passage salarial</h3>
        </div>

        <div>
          <label className="text-sm font-medium text-[#1A2E22]">
            Durée minimale d'ancienneté pour le passage salarial
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              type="number" min={1} max={36}
              value={thresholdMonths}
              onChange={e => setThresholdMonths(Math.max(1, Math.min(36, +e.target.value)))}
              className="w-24 border border-[#E2EAE5] rounded-xl px-4 py-2 text-center font-bold text-lg focus:outline-none focus:border-[#0B7439]"
            />
            <span className="text-[#4A6B55] font-medium">mois</span>
            <span className="text-xs text-[#8AA898]">(défaut : 6 mois)</span>
          </div>
          <p className="text-xs text-[#8AA898] mt-2">
            Modifiable selon la politique de l'entreprise. La modification s'applique aux nouveaux calculs uniquement — non rétroactive.
          </p>
        </div>

        <div className="flex items-center gap-3 p-4 bg-[#F8FAF8] rounded-xl">
          <input
            type="checkbox"
            id="requires_hr_validation"
            checked={requiresHrVal}
            onChange={e => setRequiresHrVal(e.target.checked)}
            className="w-4 h-4 accent-[#0B7439] flex-shrink-0"
          />
          <label htmlFor="requires_hr_validation" className="text-sm text-[#1A2E22] cursor-pointer">
            <span className="font-medium">Validation RH obligatoire</span> avant le passage au statut salarié
            <span className="block text-xs text-[#8AA898] mt-0.5">
              Si coché, le passage ne s'effectue pas automatiquement — le RH doit valider manuellement via la fiche employé.
            </span>
          </label>
        </div>

        <div className="bg-[#F0FBF4] border border-[#D4EDDA] rounded-xl p-4 text-sm text-[#0B7439]">
          <strong>Effet sur les données :</strong> après enregistrement, le trigger recalculera
          le statut d'éligibilité de tous les chauffeurs contractuels lors de leur prochaine modification.
          Les chauffeurs déjà marqués "converti" ne sont pas affectés.
        </div>

        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 bg-[#0B7439] text-white font-bold px-6 py-2.5 rounded-xl hover:bg-[#085c2d] disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </button>
      </div>
    </div>
  )
}
