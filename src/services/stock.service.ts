import { supabase } from './supabase'
import type {
  StockArticle, StockEntry, StockExit, StockTire,
  StockDashboardKPIs, CompanyOption, BusOption, GarageOption,
} from '@/types/stock.types'

export async function fetchArticles(): Promise<StockArticle[]> {
  const { data, error } = await supabase.rpc('gp_get_articles_with_computed_stock')
  if (error) throw error
  return (data ?? []) as StockArticle[]
}

export async function createArticle(article: {
  item_type: string
  designation: string
  brand?: string
  reference?: string
  category?: string
  unit_price?: number
  alert_threshold?: number
  supplier?: string
  observation?: string
}): Promise<StockArticle> {
  const { data, error } = await supabase
    .from('gp_stock_articles')
    .insert({
      ...article,
      quantity_in_stock: 0,
    })
    .select()
    .single()
  if (error) throw error
  return data as StockArticle
}

export async function updateArticle(id: string, updates: Partial<StockArticle>): Promise<StockArticle> {
  const { quantity_in_stock: _q, computed_stock: _c, total_entries: _te, total_exits: _tx, last_entry_price: _lp, ...safeUpdates } = updates as any
  const { data, error } = await supabase
    .from('gp_stock_articles')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as StockArticle
}

export async function softDeleteArticle(id: string): Promise<void> {
  const { error } = await supabase
    .from('gp_stock_articles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function fetchEntries(filters?: {
  article_id?: string | null
  date_from?: string | null
  date_to?: string | null
}): Promise<StockEntry[]> {
  let q = supabase
    .from('gp_stock_entries')
    .select('*, article:gp_stock_articles(id, designation, item_type, brand, reference)')
    .order('entry_date', { ascending: false })

  if (filters?.article_id) q = q.eq('article_id', filters.article_id)
  if (filters?.date_from) q = q.gte('entry_date', filters.date_from)
  if (filters?.date_to) q = q.lte('entry_date', filters.date_to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as StockEntry[]
}

export async function createEntry(entry: {
  article_id: string
  entry_date: string
  quantity: number
  unit_price: number
  supplier?: string
  invoice_number?: string
  observation?: string
}): Promise<StockEntry> {
  const { data, error } = await supabase
    .from('gp_stock_entries')
    .insert(entry)
    .select('*, article:gp_stock_articles(id, designation, item_type, brand, reference)')
    .single()
  if (error) throw error
  return data as StockEntry
}

export async function fetchExits(filters?: {
  article_id?: string | null
  company_id?: string | null
  bus_id?: string | null
  date_from?: string | null
  date_to?: string | null
}): Promise<StockExit[]> {
  let q = supabase
    .from('gp_stock_exits')
    .select(`
      *,
      article:gp_stock_articles(id, designation, item_type, brand, reference),
      company:companies!gp_stock_exits_company_id_fkey(id, name, code),
      group:companies!gp_stock_exits_group_id_fkey(id, name, code),
      bus:buses!gp_stock_exits_bus_id_fkey(id, registration_number, brand, model),
      garage:garages!gp_stock_exits_garage_id_fkey(id, name)
    `)
    .order('exit_date', { ascending: false })

  if (filters?.article_id) q = q.eq('article_id', filters.article_id)
  if (filters?.company_id) q = q.eq('company_id', filters.company_id)
  if (filters?.bus_id) q = q.eq('bus_id', filters.bus_id)
  if (filters?.date_from) q = q.gte('exit_date', filters.date_from)
  if (filters?.date_to) q = q.lte('exit_date', filters.date_to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as StockExit[]
}

export async function createExit(exit: {
  article_id: string
  exit_date: string
  quantity: number
  unit_price: number
  company_id?: string | null
  group_id?: string | null
  bus_id?: string | null
  garage_id?: string | null
  exit_reason?: string
  requester_name?: string
  validator_name?: string
  observation?: string
}): Promise<StockExit> {
  const { data, error } = await supabase
    .from('gp_stock_exits')
    .insert(exit)
    .select(`
      *,
      article:gp_stock_articles(id, designation, item_type, brand, reference),
      company:companies!gp_stock_exits_company_id_fkey(id, name, code),
      bus:buses!gp_stock_exits_bus_id_fkey(id, registration_number, brand, model)
    `)
    .single()
  if (error) throw error
  return data as StockExit
}

export async function fetchTires(filters?: {
  status?: string | null
  brand?: string | null
  bus_id?: string | null
}): Promise<StockTire[]> {
  let q = supabase
    .from('gp_stock_tires')
    .select(`
      *,
      article:gp_stock_articles(id, designation, item_type),
      bus:buses(id, registration_number, brand, model)
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.brand) q = q.eq('brand', filters.brand)
  if (filters?.bus_id) q = q.eq('bus_id', filters.bus_id)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as StockTire[]
}

export async function createTire(tire: {
  article_id?: string | null
  brand: string
  dimension: string
  serial_number?: string
  bus_id?: string | null
  exit_date?: string | null
  mileage_at_install?: number
  status?: string
  observation?: string
}): Promise<StockTire> {
  const { data, error } = await supabase
    .from('gp_stock_tires')
    .insert(tire)
    .select('*, bus:buses(id, registration_number, brand, model)')
    .single()
  if (error) throw error
  return data as StockTire
}

export async function updateTire(id: string, updates: Partial<StockTire>): Promise<StockTire> {
  const { data, error } = await supabase
    .from('gp_stock_tires')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, bus:buses(id, registration_number, brand, model)')
    .single()
  if (error) throw error
  return data as StockTire
}

export async function fetchDashboardKPIs(): Promise<StockDashboardKPIs> {
  const { data, error } = await supabase.rpc('gp_stock_dashboard_kpis')
  if (error) throw error
  return data as StockDashboardKPIs
}

export async function fetchCompanies(): Promise<CompanyOption[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, code, is_group, parent_id')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as CompanyOption[]
}

export async function fetchBuses(companyId?: string | null): Promise<BusOption[]> {
  let q = supabase
    .from('buses')
    .select('id, registration_number, brand, model, company_id')
    .order('registration_number')
  if (companyId) q = q.eq('company_id', companyId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BusOption[]
}

export async function fetchGarages(): Promise<GarageOption[]> {
  const { data, error } = await supabase
    .from('garages')
    .select('id, name')
    .order('name')
  if (error) throw error
  return (data ?? []) as GarageOption[]
}
