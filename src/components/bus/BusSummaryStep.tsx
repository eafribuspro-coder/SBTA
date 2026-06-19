import React from 'react'
import type { BusParameters } from './BusParametersStep'
import type { GridLayout } from './SeatPlanBuilder'
import { countReservableSeats, countAisles, countByType } from './SeatPlanBuilder'

interface GeneralInfo {
  registration_number: string
  brand: string
  model: string
  year: number
  class: string
  company_id: string
}

interface Company {
  id: string
  name: string
}

interface BusSummaryStepProps {
  generalInfo: GeneralInfo
  params: BusParameters
  simpleLayout: GridLayout | null
  lowerLayout: GridLayout | null
  upperLayout: GridLayout | null
  companies: Company[]
  isSaving: boolean
  onSave: () => void
  onBack: () => void
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E2EAE5] overflow-hidden">
      <div className="px-4 py-3 bg-[#F0FBF4] border-b border-[#E2EAE5]">
        <h4 className="font-bold text-sm text-[#0B7439]">{title}</h4>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-[#4A6B55]">{label}</span>
      <span className="font-semibold text-[#1A2E22]">{value ?? '—'}</span>
    </div>
  )
}

const deckTypeLabel = (v: string) =>
  v === 'imperial' ? 'Bus impérial (2 niveaux)' : 'Simple étage'

const driverLabel = (v: string) => `Côté ${v}`

const sleepingLabel = (v: string) => {
  if (v === 'couchettes') return 'Couchettes'
  if (v === 'mixte') return 'Mixte (sièges + couchettes)'
  return 'Non (sièges uniquement)'
}

const classLabel = (v: string) =>
  ({ standard: 'Standard', vip: 'VIP', executive: 'Executive' })[v] ?? v

export default function BusSummaryStep({
  generalInfo,
  params,
  simpleLayout,
  lowerLayout,
  upperLayout,
  companies,
  isSaving,
  onSave,
  onBack,
}: BusSummaryStepProps) {
  const company = companies.find(c => c.id === generalInfo.company_id)
  const isSimple = params.deckType === 'simple'
  const layout = isSimple ? simpleLayout : null

  const totalSimple = layout ? countReservableSeats(layout) : 0
  const totalLower = lowerLayout ? countReservableSeats(lowerLayout) : 0
  const totalUpper = upperLayout ? countReservableSeats(upperLayout) : 0
  const totalImperial = totalLower + totalUpper

  const layoutReady = isSimple ? !!simpleLayout : (!!lowerLayout || !!upperLayout)

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold text-[#1A2E22]">Récapitulatif de la configuration</h3>

      <SummaryCard title="Informations générales">
        <Row label="Immatriculation" value={generalInfo.registration_number} />
        <Row label="Marque / Modèle" value={`${generalInfo.brand} ${generalInfo.model} (${generalInfo.year})`} />
        <Row label="Classe" value={classLabel(generalInfo.class)} />
        <Row label="Société" value={company?.name} />
      </SummaryCard>

      <SummaryCard title="Paramètres avancés">
        <Row label="Type de bus" value={deckTypeLabel(params.deckType)} />
        <Row label="Conducteur" value={driverLabel(params.driverPosition)} />
        <Row label="Couchage" value={sleepingLabel(params.sleepingType)} />
        <Row label="Capacité max autorisée" value={`${params.maxCapacity} places`} />
      </SummaryCard>

      <SummaryCard title="Plan de sièges">
        {!layoutReady ? (
          <p className="text-sm text-amber-600 font-medium py-1">
            Aucun plan généré — retournez à l'étape 3 pour créer le plan de sièges.
          </p>
        ) : isSimple && layout ? (
          <>
            <Row label="Total sièges réservables" value={totalSimple} />
            <Row label="Allées" value={countAisles(layout)} />
            <Row label="Sièges VIP" value={countByType(layout, 'vip')} />
            <Row label="Couchettes" value={countByType(layout, 'couchette')} />
            <Row label="PMR" value={countByType(layout, 'pmr')} />
            <Row label="Hors service" value={countByType(layout, 'hors_service')} />
          </>
        ) : (
          <>
            <Row label="Sièges niveau inférieur" value={totalLower} />
            <Row label="Sièges niveau supérieur" value={totalUpper} />
            <Row label="Total sièges" value={totalImperial} />
          </>
        )}
      </SummaryCard>

      {!layoutReady && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Le plan de sièges n'a pas encore été généré. Vous pouvez enregistrer le bus sans plan et le configurer plus tard, ou retourner à l'étape 3.
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-3 border-2 border-[#E2EAE5] text-[#4A6B55] rounded-xl font-semibold text-sm hover:border-[#0B7439] hover:text-[#0B7439] transition-colors"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 py-3 bg-[#0B7439] text-white rounded-xl font-bold text-sm hover:bg-[#085c2d] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer le bus et le plan'}
        </button>
      </div>
    </div>
  )
}
