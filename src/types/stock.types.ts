export type ItemType = 'piece' | 'pneu' | 'lubrifiant' | 'filtre' | 'accessoire' | 'autre'
export type TireStatus = 'en_stock' | 'monte' | 'use' | 'reforme'

export interface StockArticle {
  id: string
  item_type: ItemType
  designation: string
  brand: string
  reference: string
  category: string
  quantity_in_stock: number
  computed_stock: number
  total_entries: number
  total_exits: number
  unit_price: number
  last_entry_price: number
  alert_threshold: number
  supplier: string
  observation: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockEntry {
  id: string
  article_id: string
  entry_date: string
  quantity: number
  unit_price: number
  total_amount: number
  supplier: string
  invoice_number: string
  observation: string
  created_by: string | null
  created_at: string
  article?: StockArticle
}

export interface StockExit {
  id: string
  article_id: string
  exit_date: string
  quantity: number
  unit_price: number
  total_amount: number
  company_id: string | null
  group_id: string | null
  bus_id: string | null
  garage_id: string | null
  exit_reason: string
  requester_name: string
  validator_name: string
  observation: string
  created_by: string | null
  created_at: string
  article?: StockArticle
  company?: { id: string; name: string; code: string }
  group?: { id: string; name: string; code: string }
  bus?: { id: string; registration_number: string; brand: string; model: string }
  garage?: { id: string; name: string }
}

export interface StockTire {
  id: string
  article_id: string | null
  brand: string
  dimension: string
  serial_number: string
  bus_id: string | null
  exit_date: string | null
  mileage_at_install: number
  status: TireStatus
  observation: string
  created_by: string | null
  created_at: string
  updated_at: string
  article?: StockArticle
  bus?: { id: string; registration_number: string; brand: string; model: string }
}

export interface StockDashboardKPIs {
  total_articles: number
  total_stock: number
  stock_value: number
  low_stock_count: number
  out_of_stock_count: number
  entries_month_count: number
  exits_month_count: number
  entries_month_value: number
  exits_month_value: number
}

export interface CompanyOption {
  id: string
  name: string
  code: string
  is_group: boolean
  parent_id: string | null
}

export interface BusOption {
  id: string
  registration_number: string
  brand: string
  model: string
  company_id: string
}

export interface GarageOption {
  id: string
  name: string
}
