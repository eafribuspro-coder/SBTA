// Surcouche "live" des rubriques de primes rattachées aux employés. Recharge les
// primes actives (employee_primes) et leur rubrique (prime_rubrics), calcule le
// montant de chaque prime pour une période donnée puis les ventile dans les
// rubriques de paie (sursalaire, transport, primes, indemnités, avantages, primes
// non imposables). Garantit que toute prime saisie après la génération est prise
// en compte dans tous les rapports RH (Bulletins, Livre de paie, Masse salariale).

import { supabase } from '@/services/supabase'
import type { PaySlip, PrimeRubric, PrimeDetail, PrimeBucket } from '@/types/hr.types'

export interface PrimeBuckets {
  sursalaire: number
  transport: number
  primes: number
  indemnites: number
  avantages: number
  primesNonImposables: number
  details: PrimeDetail[]
}

export type PrimeMap = Record<string, PrimeBuckets>

export const EMPTY_PRIME_MAP: PrimeMap = {}

type AssignmentRow = {
  id: string
  employee_id: string
  employee_source: string
  rubric_id: string
  amount: number | string | null
  period_year: number | null
  period_month: number | null
}

function emptyBuckets(): PrimeBuckets {
  return { sursalaire: 0, transport: 0, primes: 0, indemnites: 0, avantages: 0, primesNonImposables: 0, details: [] }
}

// Nombre d'années complètes d'ancienneté à la fin de la période de paie.
export function seniorityYears(hireDate: string | null | undefined, year: number, month: number): number {
  if (!hireDate) return 0
  const start = new Date(hireDate)
  if (isNaN(start.getTime())) return 0
  const ref = new Date(year, month, 0) // dernier jour du mois de la période
  let years = ref.getFullYear() - start.getFullYear()
  const m = ref.getMonth() - start.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < start.getDate())) years--
  return Math.max(0, years)
}

export function seniorityLabel(hireDate: string | null | undefined, year: number, month: number): string {
  if (!hireDate) return 'Non renseignée'
  const start = new Date(hireDate)
  if (isNaN(start.getTime())) return 'Non renseignée'
  const ref = new Date(year, month, 0)
  let y = ref.getFullYear() - start.getFullYear()
  let m = ref.getMonth() - start.getMonth()
  if (ref.getDate() < start.getDate()) m--
  if (m < 0) { y--; m += 12 }
  if (y < 0) return '0 mois'
  const yPart = y > 0 ? `${y} an${y > 1 ? 's' : ''}` : ''
  const mPart = m > 0 ? `${m} mois` : ''
  if (yPart && mPart) return `${yPart} ${mPart}`
  return yPart || mPart || '0 mois'
}

// Taux légal CI de prime d'ancienneté : 0 avant 2 ans, puis years % plafonné à 25 %.
export function seniorityRate(years: number): number {
  if (years < 2) return 0
  return Math.min(years, 25)
}

// Montant d'une prime pour un salaire de base donné.
function resolveAmount(
  rubric: PrimeRubric,
  assignmentAmount: number | null,
  base: number,
  hireDate: string | null | undefined,
  year: number,
  month: number,
): number {
  if (assignmentAmount != null && assignmentAmount > 0) return assignmentAmount
  if (rubric.calc_type === 'seniority') {
    const rate = seniorityRate(seniorityYears(hireDate, year, month))
    return Math.round((base * rate) / 100)
  }
  if (rubric.calc_type === 'percent_base') return Math.round((base * Number(rubric.percent_rate)) / 100)
  return Number(rubric.default_amount) || 0
}

// Une prime s'applique-t-elle sur la période ? (mensuelle = toujours ; ponctuelle /
// annuelle = uniquement sur la période ciblée par le rattachement).
function appliesToPeriod(rubric: PrimeRubric, row: AssignmentRow, year: number, month: number): boolean {
  if (rubric.periodicity === 'mensuelle') return true
  return row.period_year === year && row.period_month === month
}

// Construit la map des primes par employé : clé = `${employee_id}_${employee_source}`.
// `baseByKey` fournit le salaire de base de chaque employé (requis pour les primes
// calculées en pourcentage du salaire de base).
export function buildPrimeMap(
  rows: AssignmentRow[] | null,
  rubricsById: Record<string, PrimeRubric>,
  baseByKey: Record<string, number>,
  year: number,
  month: number,
  hireDateByKey: Record<string, string | null> = {},
): PrimeMap {
  const map: PrimeMap = {}
  for (const row of rows ?? []) {
    const rubric = rubricsById[row.rubric_id]
    if (!rubric || !rubric.is_active) continue
    if (!appliesToPeriod(rubric, row, year, month)) continue

    const key = `${row.employee_id}_${row.employee_source}`
    const base = baseByKey[key] ?? 0
    const amount = resolveAmount(rubric, row.amount != null ? Number(row.amount) : null, base, hireDateByKey[key], year, month)
    if (amount <= 0) continue

    if (!map[key]) map[key] = emptyBuckets()
    const b = map[key]

    if (!rubric.is_taxable) {
      b.primesNonImposables += amount
    } else {
      const bucket: PrimeBucket = rubric.target_bucket
      b[bucket] += amount
    }
    b.details.push({ rubric_code: rubric.code, label: rubric.label, amount, taxable: rubric.is_taxable })
  }
  return map
}

// Charge les rubriques actives + les primes rattachées, puis construit la map.
export async function fetchPrimeMaps(
  year: number,
  month: number,
  baseByKey: Record<string, number>,
  hireDateByKey: Record<string, string | null> = {},
): Promise<PrimeMap> {
  const [rubricsRes, primesRes] = await Promise.all([
    supabase.from('prime_rubrics').select('*'),
    supabase.from('employee_primes')
      .select('id, employee_id, employee_source, rubric_id, amount, period_year, period_month')
      .eq('is_active', true),
  ])
  const rubricsById: Record<string, PrimeRubric> = {}
  for (const r of (rubricsRes.data as PrimeRubric[] | null) ?? []) rubricsById[r.id] = r
  return buildPrimeMap(primesRes.data as AssignmentRow[] | null, rubricsById, baseByKey, year, month, hireDateByKey)
}

// Applique les primes calculées sur un bulletin (surcouche live au moment de
// l'affichage / impression). Remplace les rubriques de gains stockées par les
// valeurs courantes lorsque l'employé a des primes actives.
export function applyPrimesToSlip(slip: PaySlip, map: PrimeMap): PaySlip {
  const key = `${slip.employee_id}_${slip.employee_source}`
  const b = map[key]
  if (!b) return slip
  return {
    ...slip,
    sursalaire: b.sursalaire,
    primes: b.primes,
    indemnites: b.indemnites,
    avantages: b.avantages,
    transport_allowance: b.transport,
    primes_non_imposables: b.primesNonImposables,
    prime_details: b.details,
  }
}
