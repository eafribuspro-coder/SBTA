// Calcul de paie conforme à la réglementation ivoirienne (Côte d'Ivoire).
// Rubriques : CNPS, Impôt sur Salaires (IS), Contribution Nationale (CN),
// Impôt Général sur le Revenu (IGR), Couverture Maladie Universelle (CMU), FDFP.
// Barèmes : Direction Générale des Impôts (DGI) + CNPS.

import type { MaritalStatus, PaySlip } from '@/types/hr.types'

const ABATTEMENT = 0.8 // abattement forfaitaire de 20%
const IS_RATE = 0.012 // 1,5% sur base abattue = 1,2% du brut imposable
const IS_EMPLOYER_RATE = 0.012
const FDFP_TA_RATE = 0.004 // Taxe d'Apprentissage
const FDFP_FPC_RATE = 0.012 // Formation Professionnelle Continue

const CNPS_EMPLOYEE_RATE = 0.063 // retraite part salariale
const CNPS_EMPLOYER_RATE = 0.077 // retraite part patronale
const CNPS_CEILING = 3_375_000 // plafond mensuel retraite (45 x SMIG)
const PF_RATE = 0.0575 // prestations familiales (patronal)
const AT_RATE = 0.05 // accident du travail (patronal)
const PF_AT_CEILING = 70_000 // plafond mensuel PF / AT

const CMU_EMPLOYEE = 500 // part salariale par personne couverte (1 000 F répartis 500/500)
const CMU_EMPLOYER = 500

export const TRANSPORT_EXONERATION = 30_000 // prime transport non imposable (plafond)

// Barème mensuel de la Contribution Nationale (sur revenu net imposable).
const CN_BRACKETS: Array<{ limit: number; rate: number }> = [
  { limit: 50_000, rate: 0 },
  { limit: 130_000, rate: 0.015 },
  { limit: 200_000, rate: 0.05 },
  { limit: Infinity, rate: 0.1 },
]

// Barème IGR mensuel (DGI). coef = num/den ; déduction par part.
const IGR_BRACKETS: Array<{ max: number; num: number; den: number; deduct: number }> = [
  { max: 25_000, num: 0, den: 1, deduct: 0 },
  { max: 45_583, num: 10, den: 110, deduct: 2_273 },
  { max: 81_583, num: 15, den: 115, deduct: 4_076 },
  { max: 126_883, num: 20, den: 120, deduct: 7_031 },
  { max: 220_383, num: 25, den: 125, deduct: 11_250 },
  { max: 389_083, num: 35, den: 135, deduct: 24_306 },
  { max: 842_166, num: 45, den: 145, deduct: 44_181 },
  { max: Infinity, num: 60, den: 160, deduct: 98_633 },
]

export interface PayrollInput {
  baseSalary: number
  sursalaire?: number
  primes?: number
  indemnites?: number
  avantages?: number
  transport?: number
  primesNonImposables?: number // primes non soumises à cotisations / impôts
  maritalStatus: MaritalStatus | null
  childrenCount: number
  otherDeductions?: number // contraventions, sanctions, retenues diverses
  loanDeductions?: number // remboursements emprunts / avances / acomptes
}

export interface PayrollResult {
  parts: number
  transportNonImposable: number
  primesNonImposables: number
  taxableGross: number // Salaire Brut Imposable (A)
  socialGross: number // base CNPS
  netImposable: number // 80% du brut imposable
  totalGains: number

  // Retenues salariales légales
  is: number
  cn: number
  igr: number
  cnpsEmployee: number
  cmuEmployee: number
  statutoryRetenues: number // CNPS + IS + CN + IGR + CMU

  // Autres retenues
  otherDeductions: number
  loanDeductions: number
  totalRetenues: number // statutaires + autres

  // Charges patronales
  cnpsEmployer: number
  prestationFamiliale: number
  accidentTravail: number
  isEmployer: number
  fdfpTa: number
  fdfpFpc: number
  cmuEmployer: number
  totalChargesPatronales: number

  salaireNet: number // SBI − retenues statutaires
  netSalary: number // = Net à payer (alias compat)
  netAPayer: number
  coutGlobalEmployeur: number // gains + charges patronales
}

// Nombre de parts (quotient familial) selon situation matrimoniale et enfants.
export function computeParts(marital: MaritalStatus | null, children: number): number {
  const k = Math.max(0, children)
  let parts: number
  if (marital === 'marie') {
    parts = 2 + 0.5 * k
  } else if (marital === 'veuf') {
    parts = k === 0 ? 1 : 2 + 0.5 * k
  } else {
    // célibataire / divorcé
    parts = k === 0 ? 1 : 1.5 + 0.5 * k
  }
  return Math.min(parts, 5)
}

function computeCN(netImposable: number): number {
  let cn = 0
  let prev = 0
  for (const { limit, rate } of CN_BRACKETS) {
    if (netImposable <= prev) break
    const taxable = Math.min(netImposable, limit) - prev
    cn += taxable * rate
    prev = limit
  }
  return Math.round(cn)
}

function computeIGR(revenu: number, parts: number): number {
  const q = revenu / parts
  const bracket = IGR_BRACKETS.find((b) => q < b.max) ?? IGR_BRACKETS[IGR_BRACKETS.length - 1]
  if (bracket.num === 0) return 0
  const igr = (revenu * bracket.num) / bracket.den - bracket.deduct * parts
  return Math.max(0, Math.round(igr))
}

export function computePayroll(input: PayrollInput): PayrollResult {
  const base = Number(input.baseSalary) || 0
  const sursalaire = Number(input.sursalaire) || 0
  const primes = Number(input.primes) || 0
  const indemnites = Number(input.indemnites) || 0
  const avantages = Number(input.avantages) || 0
  const transport = Number(input.transport) || 0
  const primesNonImposablesInput = Number(input.primesNonImposables) || 0
  const otherDeductions = Number(input.otherDeductions) || 0
  const loanDeductions = Number(input.loanDeductions) || 0

  const transportNonImposable = Math.min(transport, TRANSPORT_EXONERATION)
  const transportImposable = Math.max(0, transport - TRANSPORT_EXONERATION)

  const taxableGross = base + sursalaire + primes + indemnites + avantages + transportImposable
  const socialGross = taxableGross
  const netImposable = taxableGross * ABATTEMENT

  const parts = computeParts(input.maritalStatus, input.childrenCount)

  const is = Math.round(taxableGross * IS_RATE)
  const cn = computeCN(netImposable)
  const revenu = (netImposable - is - cn) * 0.85
  const igr = computeIGR(revenu, parts)

  const cnpsBase = Math.min(socialGross, CNPS_CEILING)
  const cnpsEmployee = Math.round(cnpsBase * CNPS_EMPLOYEE_RATE)
  const cmuPersons = 1 + (input.maritalStatus === 'marie' ? 1 : 0) + Math.max(0, Number(input.childrenCount) || 0)
  const cmuEmployee = CMU_EMPLOYEE * cmuPersons
  const cmuEmployer = CMU_EMPLOYER * cmuPersons

  const cnpsEmployer = Math.round(cnpsBase * CNPS_EMPLOYER_RATE)
  const pfAtBase = Math.min(socialGross, PF_AT_CEILING)
  const prestationFamiliale = Math.round(pfAtBase * PF_RATE)
  const accidentTravail = Math.round(pfAtBase * AT_RATE)
  const isEmployer = Math.round(taxableGross * IS_EMPLOYER_RATE)
  const fdfpTa = Math.round(taxableGross * FDFP_TA_RATE)
  const fdfpFpc = Math.round(taxableGross * FDFP_FPC_RATE)

  const primesNonImposables = primesNonImposablesInput + transportNonImposable

  const statutoryRetenues = is + cn + igr + cnpsEmployee + cmuEmployee
  const salaireNet = taxableGross - statutoryRetenues

  const totalGains = taxableGross + primesNonImposables
  const totalRetenues = statutoryRetenues + otherDeductions + loanDeductions
  const totalChargesPatronales =
    cnpsEmployer + prestationFamiliale + accidentTravail + isEmployer + fdfpTa + fdfpFpc + cmuEmployer

  const netAPayer = salaireNet + primesNonImposables - otherDeductions - loanDeductions
  const coutGlobalEmployeur = totalGains + totalChargesPatronales

  return {
    parts,
    transportNonImposable,
    primesNonImposables,
    taxableGross,
    socialGross,
    netImposable,
    totalGains,
    is,
    cn,
    igr,
    cnpsEmployee,
    cmuEmployee,
    statutoryRetenues,
    otherDeductions,
    loanDeductions,
    totalRetenues,
    cnpsEmployer,
    prestationFamiliale,
    accidentTravail,
    isEmployer,
    fdfpTa,
    fdfpFpc,
    cmuEmployer,
    totalChargesPatronales,
    salaireNet,
    netSalary: netAPayer,
    netAPayer,
    coutGlobalEmployeur,
  }
}

// Recalcule la paie à partir d'un bulletin enregistré, pour garantir que tous
// les rapports RH (Livre de paie, Masse salariale) partagent la même base.
export function payrollFromSlip(slip: PaySlip): PayrollResult {
  return computePayroll({
    baseSalary: Number(slip.base_salary) || 0,
    sursalaire: Number(slip.sursalaire) || 0,
    primes: Number(slip.primes) || 0,
    indemnites: Number(slip.indemnites) || 0,
    avantages: Number(slip.avantages) || 0,
    transport: Number(slip.transport_allowance) || 0,
    primesNonImposables: Number(slip.primes_non_imposables) || 0,
    maritalStatus: (slip.employee_marital_status as MaritalStatus | null) ?? null,
    childrenCount: Number(slip.employee_children_count) || 0,
    otherDeductions: Number(slip.retenues) || 0,
    loanDeductions: Number(slip.loan_deductions) || 0,
  })
}
