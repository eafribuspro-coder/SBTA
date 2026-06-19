import { supabase } from '@/services/supabase'
import type {
  VehicleInsurance,
  InsuranceInput,
  InsuranceStatus,
  AlertLevel,
  InsuranceAlert,
  Insurer,
  InsurerInput,
  InsurerType,
} from '@/types/insurance.types'

export interface InsuranceBus {
  id:                  string
  registration_number: string
  brand:               string | null
  model:               string | null
  class:               string | null
  company_id:          string | null
  status:              string | null
  is_active:           boolean | null
}

export interface InsuranceCompany {
  id:   string
  name: string
  code: string
}

const SELECT = `
  *,
  company:companies ( id, name, code )
`

function mapRow(row: any): VehicleInsurance {
  return {
    ...row,
    amount: Number(row.amount ?? 0),
    company_name: row.company?.name ?? null,
    company_code: row.company?.code ?? null,
  }
}

export async function fetchInsurances(): Promise<VehicleInsurance[]> {
  const { data, error } = await supabase
    .from('vehicle_insurances')
    .select(SELECT)
    .order('expiry_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

export async function fetchBuses(): Promise<InsuranceBus[]> {
  const { data, error } = await supabase
    .from('buses')
    .select('id, registration_number, brand, model, class, company_id, status, is_active')
    .order('registration_number', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchCompanies(): Promise<InsuranceCompany[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, code')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchInsuranceHistory(busId: string): Promise<VehicleInsurance[]> {
  const { data, error } = await supabase
    .from('vehicle_insurances')
    .select(SELECT)
    .eq('bus_id', busId)
    .order('effect_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapRow)
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Utilisateur non authentifié')
  return data.user.id
}

export async function createInsurance(input: InsuranceInput): Promise<VehicleInsurance> {
  const created_by = await currentUserId()
  const { data, error } = await supabase
    .from('vehicle_insurances')
    .insert({ ...input, created_by, is_current: true })
    .select(SELECT)
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function updateInsurance(id: string, input: InsuranceInput): Promise<VehicleInsurance> {
  const { data, error } = await supabase
    .from('vehicle_insurances')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function deleteInsurance(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_insurances').delete().eq('id', id)
  if (error) throw error
}

// Renouvellement: archive l'ancienne, crée une nouvelle période en conservant l'historique
export async function renewInsurance(oldId: string, input: InsuranceInput): Promise<VehicleInsurance> {
  const created_by = await currentUserId()

  const { error: archiveErr } = await supabase
    .from('vehicle_insurances')
    .update({ status: 'renouvele', is_current: false, updated_at: new Date().toISOString() })
    .eq('id', oldId)
  if (archiveErr) throw archiveErr

  const { data, error } = await supabase
    .from('vehicle_insurances')
    .insert({ ...input, created_by, is_current: true, renewed_from_id: oldId, status: 'actif' })
    .select(SELECT)
    .single()
  if (error) throw error
  return mapRow(data)
}

export async function uploadInsuranceDocument(file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `docs/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('insurance-docs').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from('insurance-docs').getPublicUrl(path)
  return data.publicUrl
}

// ── Helpers de statut & alertes ─────────────────────────────────

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

// Statut effectif calculé à partir des dates (sauf renouvelé/inactif qui sont figés)
export function effectiveStatus(ins: VehicleInsurance): InsuranceStatus {
  if (ins.status === 'renouvele') return 'renouvele'
  if (ins.status === 'inactif') return 'inactif'
  const d = daysUntil(ins.expiry_date)
  if (d < 0) return 'expire'
  if (d <= 30) return 'proche_echeance'
  return 'actif'
}

export function alertLevel(ins: VehicleInsurance): AlertLevel {
  const s = effectiveStatus(ins)
  switch (s) {
    case 'renouvele': return 'blue'
    case 'expire':    return 'red'
    case 'proche_echeance': return 'orange'
    case 'inactif':   return 'gray'
    default:          return 'green'
  }
}

// Notifications: 60j, 30j, 7j avant échéance et le jour J (assurances en cours)
export function buildAlerts(insurances: VehicleInsurance[]): InsuranceAlert[] {
  const alerts: InsuranceAlert[] = []
  for (const ins of insurances) {
    if (!ins.is_current) continue
    if (ins.status === 'renouvele' || ins.status === 'inactif') continue
    const d = daysUntil(ins.expiry_date)
    const reg = ins.registration_number ?? 'Véhicule'
    let threshold: 60 | 30 | 7 | 0 | null = null
    let level: AlertLevel = 'green'
    let message = ''

    if (d < 0) {
      threshold = 0
      level = 'red'
      message = `${reg} : assurance expirée depuis ${Math.abs(d)} j`
    } else if (d === 0) {
      threshold = 0
      level = 'red'
      message = `${reg} : assurance arrive à échéance aujourd'hui`
    } else if (d <= 7) {
      threshold = 7
      level = 'orange'
      message = `${reg} : échéance dans ${d} j`
    } else if (d <= 30) {
      threshold = 30
      level = 'orange'
      message = `${reg} : échéance dans ${d} j`
    } else if (d <= 60) {
      threshold = 60
      level = 'orange'
      message = `${reg} : échéance dans ${d} j`
    }

    if (threshold !== null) {
      alerts.push({ insurance: ins, level, daysLeft: d, threshold, message })
    }
  }
  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}

export const STATUS_LABELS: Record<InsuranceStatus, string> = {
  actif:           'Actif',
  proche_echeance: 'Proche échéance',
  expire:          'Expiré',
  renouvele:       'Renouvelé',
  inactif:         'Inactif',
}

// ── Assureurs (compagnies d'assurance) ──────────────────────────

export const INSURER_TYPE_LABELS: Record<InsurerType, string> = {
  automobile:  'Assurance automobile',
  transport:   'Assurance transport',
  sante:       'Assurance santé',
  vie:         'Assurance vie',
  multirisque: 'Assurance multirisque',
  autre:       'Autre',
}

export async function fetchInsurers(): Promise<Insurer[]> {
  const { data, error } = await supabase
    .from('insurers')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createInsurer(input: InsurerInput): Promise<Insurer> {
  const created_by = await currentUserId()
  const { data, error } = await supabase
    .from('insurers')
    .insert({ ...input, created_by })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateInsurer(id: string, input: InsurerInput): Promise<Insurer> {
  const { data, error } = await supabase
    .from('insurers')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteInsurer(id: string): Promise<void> {
  const { error } = await supabase.from('insurers').delete().eq('id', id)
  if (error) throw error
}
