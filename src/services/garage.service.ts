import { supabase } from './supabase'
import type { Garage, MaintenanceQuote, GarageStaffMember } from '../types/garage.types'

// ── Garages ──────────────────────────────────────────────────────────────────

export async function fetchGarages(): Promise<Garage[]> {
  const { data, error } = await supabase
    .from('garage_stats')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as Garage[]
}

export async function fetchGarageById(id: string): Promise<Garage> {
  const { data, error } = await supabase
    .from('garage_stats')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Garage introuvable')
  return data as Garage
}

export async function createGarage(payload: Partial<Garage>): Promise<void> {
  const { error } = await supabase.from('garages').insert(payload)
  if (error) throw error
}

export async function updateGarage(id: string, payload: Partial<Garage>): Promise<void> {
  const { error } = await supabase
    .from('garages')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Raw list for selects (no stats needed)
export async function fetchGaragesSimple(): Promise<{ id: string; name: string; code: string; garage_type: string }[]> {
  const { data, error } = await supabase
    .from('garages')
    .select('id, name, code, garage_type')
    .neq('status', 'archive')
    .order('name')
  if (error) throw error
  return data ?? []
}

// ── Garage Staff ──────────────────────────────────────────────────────────────

export async function fetchGarageStaff(garageId: string): Promise<GarageStaffMember[]> {
  const { data, error } = await supabase
    .from('garage_staff')
    .select('*, user:users!garage_staff_user_id_fkey(full_name, email)')
    .eq('garage_id', garageId)
    .order('assigned_at')
  if (error) throw error
  return (data ?? []) as GarageStaffMember[]
}

export async function addGarageStaff(garageId: string, userId: string, role: string, assignedBy: string): Promise<void> {
  const { error } = await supabase.from('garage_staff').insert({
    garage_id:      garageId,
    user_id:        userId,
    role_in_garage: role,
    assigned_by:    assignedBy,
  })
  if (error) throw error
}

export async function removeGarageStaff(id: string): Promise<void> {
  const { error } = await supabase
    .from('garage_staff')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ── Buses in a garage ─────────────────────────────────────────────────────────

export interface BusInGarage {
  id:                  string
  registration_number: string
  brand:               string
  model:               string
  status:              string
  company_id:          string
  company_name:        string
}

export async function fetchBusesInGarage(garageId: string): Promise<BusInGarage[]> {
  const { data, error } = await supabase
    .from('buses')
    .select('id, registration_number, brand, model, status, company_id, companies(name)')
    .eq('current_garage_id', garageId)
  if (error) throw error
  return (data ?? []).map((b: any) => ({
    ...b,
    company_name: b.companies?.name ?? '—',
  }))
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export async function fetchQuotesByGarage(garageId: string): Promise<MaintenanceQuote[]> {
  const { data, error } = await supabase
    .from('maintenance_quotes')
    .select(`
      *,
      garage:garages(name),
      bus:buses(registration_number, company_id, companies(name)),
      creator:users!maintenance_quotes_created_by_fkey(full_name),
      submittedTo:users!maintenance_quotes_submitted_to_fkey(full_name),
      validatedBy:users!maintenance_quotes_validated_by_fkey(full_name)
    `)
    .eq('garage_id', garageId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return mapQuotes(data ?? [])
}

export async function fetchQuotesByCompany(companyId: string): Promise<MaintenanceQuote[]> {
  const { data, error } = await supabase
    .from('maintenance_quotes')
    .select(`
      *,
      garage:garages(name),
      bus:buses(registration_number, company_id, companies(name)),
      creator:users!maintenance_quotes_created_by_fkey(full_name),
      submittedTo:users!maintenance_quotes_submitted_to_fkey(full_name),
      validatedBy:users!maintenance_quotes_validated_by_fkey(full_name)
    `)
    .eq('bus_company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return mapQuotes(data ?? [])
}

export async function fetchPendingQuotesForComptable(companyId: string): Promise<MaintenanceQuote[]> {
  const { data, error } = await supabase
    .from('maintenance_quotes')
    .select(`
      *,
      garage:garages(name),
      bus:buses(registration_number, company_id, companies(name)),
      creator:users!maintenance_quotes_created_by_fkey(full_name)
    `)
    .eq('bus_company_id', companyId)
    .eq('status', 'soumis_comptable')
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return mapQuotes(data ?? [])
}

export async function fetchQuoteById(id: string): Promise<MaintenanceQuote> {
  const { data, error } = await supabase
    .from('maintenance_quotes')
    .select(`
      *,
      garage:garages(name),
      bus:buses(registration_number, company_id, companies(name)),
      creator:users!maintenance_quotes_created_by_fkey(full_name),
      submittedTo:users!maintenance_quotes_submitted_to_fkey(full_name),
      validatedBy:users!maintenance_quotes_validated_by_fkey(full_name)
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Devis introuvable')
  return mapQuotes([data])[0]
}

export async function createQuote(payload: Partial<MaintenanceQuote> & { garage_id: string; bus_id: string; created_by: string; title: string; problem_description: string }): Promise<string> {
  const { data, error } = await supabase
    .from('maintenance_quotes')
    .insert(payload)
    .select('id')
    .maybeSingle()
  if (error) throw error
  return data!.id
}

export async function updateQuote(id: string, payload: Partial<MaintenanceQuote>): Promise<void> {
  const { error } = await supabase
    .from('maintenance_quotes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function submitQuote(id: string, submittedTo: string | null): Promise<void> {
  const { error } = await supabase
    .from('maintenance_quotes')
    .update({
      status:       'soumis_comptable',
      submitted_at: new Date().toISOString(),
      submitted_to: submittedTo,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function validateQuote(id: string, validatedBy: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_quotes')
    .update({
      status:       'valide',
      validated_by: validatedBy,
      validated_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function rejectQuote(id: string, reason: string, rejectedBy: string): Promise<void> {
  const { error } = await supabase
    .from('maintenance_quotes')
    .update({
      status:           'rejete',
      rejection_reason: reason,
      validated_by:     rejectedBy,
      validated_at:     new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ── Internal mapper ───────────────────────────────────────────────────────────

function mapQuotes(rows: any[]): MaintenanceQuote[] {
  return rows.map(r => ({
    ...r,
    garage_name:       r.garage?.name ?? '—',
    bus_registration:  r.bus?.registration_number ?? r.bus_registration ?? '—',
    bus_company_name:  r.bus?.companies?.name ?? '—',
    created_by_name:   r.creator?.full_name ?? '—',
    submitted_to_name: r.submittedTo?.full_name ?? null,
    validated_by_name: r.validatedBy?.full_name ?? null,
    parts_items:       r.parts_items ?? [],
    photos_urls:       r.photos_urls ?? [],
  }))
}
