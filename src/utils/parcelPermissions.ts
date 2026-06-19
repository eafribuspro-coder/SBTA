import type { ParcelStatus } from '@/types/parcel.types'

/**
 * Actions that belong exclusively to the ORIGIN (departure) station.
 * Once the parcel is shipped (expedie), the origin station has no more actions.
 */
const ORIGIN_ACTIONS: ParcelStatus[] = ['enregistre', 'mis_en_paquet']

/**
 * Actions that belong exclusively to the DESTINATION (arrival) station.
 * The destination station takes over after "expedie".
 */
const DESTINATION_ACTIONS: ParcelStatus[] = ['expedie', 'arrive']

export type ParcelActionPermission =
  | { allowed: true; nextStatus: ParcelStatus; label: string; labelShort: string }
  | { allowed: false; reason: string }

const ACTION_META: Partial<Record<ParcelStatus, { label: string; labelShort: string; next: ParcelStatus }>> = {
  enregistre:    { label: 'Mettre en paquet', labelShort: 'En paquet', next: 'mis_en_paquet' },
  mis_en_paquet: { label: 'Marquer Expédié',  labelShort: 'Expédier',  next: 'expedie'       },
  expedie:       { label: 'Confirmer Arrivée',labelShort: 'Arrivé',    next: 'arrive'         },
  arrive:        { label: 'Retiré par le client', labelShort: 'Retirer', next: 'livre'          },
}

/**
 * Determine whether the agent's station can perform the next action on this parcel.
 *
 * Rules:
 *  - Terminal statuses (livre, retourne, perdu) → no action.
 *  - Current status is in ORIGIN_ACTIONS → only origin station can act.
 *  - Current status is in DESTINATION_ACTIONS → only destination station can act.
 *  - "expedie" status from origin's perspective → blocked with explicit message.
 */
export function getParcelActionPermission(
  parcelStatus: ParcelStatus,
  originStationId: string,
  destinationStationId: string,
  agentStationId: string,
): ParcelActionPermission {
  const meta = ACTION_META[parcelStatus]

  // No next action defined (terminal or unknown)
  if (!meta) {
    return { allowed: false, reason: '' }
  }

  const isOrigin      = agentStationId === originStationId
  const isDestination = agentStationId === destinationStationId

  // Agent's station is neither origin nor destination
  if (!isOrigin && !isDestination) {
    return { allowed: false, reason: 'Ce courrier n\'appartient pas à votre gare.' }
  }

  if (ORIGIN_ACTIONS.includes(parcelStatus)) {
    if (!isOrigin) {
      return {
        allowed: false,
        reason: 'Action réservée à la gare de départ.',
      }
    }
    return { allowed: true, nextStatus: meta.next, label: meta.label, labelShort: meta.labelShort }
  }

  if (DESTINATION_ACTIONS.includes(parcelStatus)) {
    if (!isDestination) {
      // Origin station trying to act after expedition
      if (isOrigin) {
        return {
          allowed: false,
          reason: 'Action non autorisée : le courrier a déjà été expédié.',
        }
      }
      return {
        allowed: false,
        reason: 'Action réservée à la gare de destination.',
      }
    }
    return { allowed: true, nextStatus: meta.next, label: meta.label, labelShort: meta.labelShort }
  }

  return { allowed: false, reason: '' }
}
