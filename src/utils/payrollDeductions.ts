// Surcouche "live" des retenues / emprunts / avances : recharge les retenues
// (salary_deductions) et remboursements d'emprunts (employee_loans) actuellement
// actifs pour une période, puis les applique sur les bulletins au moment de
// l'affichage. Garantit que tout enregistrement postérieur à la génération du
// bulletin est pris en compte dans tous les rapports RH (Bulletins, Livre de paie).

import { supabase } from '@/services/supabase'
import type { PaySlip, DeductionDetail } from '@/types/hr.types'

const DEDUCTION_LABELS: Record<string, string> = {
  contravention: 'Contravention', emprunt: 'Remb. emprunt', avance: 'Remb. avance',
  acompte: 'Remb. acompte', absence_non_justifiee: 'Absence non justifiee',
  sanction_financiere: 'Sanction financiere', autre: 'Autre retenue',
}
const LOAN_LABELS: Record<string, string> = {
  emprunt: 'Remb. emprunt social', avance: 'Remb. avance sur salaire', acompte: 'Remb. acompte',
}

type DeductionRow = { id: string; employee_id: string; employee_source: string; deduction_type: string; amount: number | string }
type LoanRow = { id: string; employee_id: string; employee_source: string; loan_type: string; installment_amount: number | string }

export interface LiveDeductionMaps {
  deductions: Record<string, DeductionDetail[]>
  loans: Record<string, DeductionDetail[]>
}

export const EMPTY_DEDUCTION_MAPS: LiveDeductionMaps = { deductions: {}, loans: {} }

export function buildDeductionMap(rows: DeductionRow[] | null): Record<string, DeductionDetail[]> {
  const map: Record<string, DeductionDetail[]> = {}
  for (const d of rows ?? []) {
    const key = `${d.employee_id}_${d.employee_source}`
    if (!map[key]) map[key] = []
    map[key].push({
      type: d.deduction_type,
      label: DEDUCTION_LABELS[d.deduction_type] || d.deduction_type,
      amount: Number(d.amount),
      ref_id: d.id,
    })
  }
  return map
}

export function buildLoanMap(rows: LoanRow[] | null): Record<string, DeductionDetail[]> {
  const map: Record<string, DeductionDetail[]> = {}
  for (const l of rows ?? []) {
    const key = `${l.employee_id}_${l.employee_source}`
    if (!map[key]) map[key] = []
    map[key].push({
      type: l.loan_type,
      label: LOAN_LABELS[l.loan_type] || `Remb. ${l.loan_type}`,
      amount: Number(l.installment_amount),
      ref_id: l.id,
    })
  }
  return map
}

export async function fetchLiveDeductions(year: number, month: number): Promise<LiveDeductionMaps> {
  const [deductionsRes, loansRes] = await Promise.all([
    supabase.from('salary_deductions')
      .select('id, employee_id, employee_source, deduction_type, amount')
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('status', 'active'),
    supabase.from('employee_loans')
      .select('id, employee_id, employee_source, loan_type, installment_amount')
      .eq('status', 'en_cours'),
  ])
  return {
    deductions: buildDeductionMap(deductionsRes.data as DeductionRow[] | null),
    loans: buildLoanMap(loansRes.data as LoanRow[] | null),
  }
}

export function enrichSlip(slip: PaySlip, maps: LiveDeductionMaps): PaySlip {
  const key = `${slip.employee_id}_${slip.employee_source}`
  const deds = maps.deductions[key]
  const loans = maps.loans[key]
  if (!deds && !loans) return slip
  const detDeds = deds ?? []
  const detLoans = loans ?? []
  return {
    ...slip,
    retenues: detDeds.reduce((s, d) => s + d.amount, 0),
    loan_deductions: detLoans.reduce((s, d) => s + d.amount, 0),
    deduction_details: [...detDeds, ...detLoans],
  }
}
