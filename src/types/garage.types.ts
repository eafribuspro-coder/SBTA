export type GarageType   = 'central' | 'sous_garage'
export type GarageStatus = 'actif' | 'inactif' | 'archive'
export type UrgencyLevel = 'faible' | 'normale' | 'elevee' | 'critique'
export type QuoteStatus  = 'brouillon' | 'soumis_comptable' | 'valide'
                         | 'rejete' | 'converti_en_ot' | 'annule'

export interface Garage {
  id:               string
  name:             string
  code:             string
  garage_type:      GarageType
  parent_garage_id: string | null
  parent_name:      string | null
  address:          string | null
  city:             string
  region:           string | null
  phone:            string | null
  email:            string | null
  station_id:       string | null
  station_name:     string | null
  // PAS de company_id — le garage est indépendant des sociétés
  chef_garage_id:   string | null
  chef_name:        string | null
  max_vehicles:     number
  status:           GarageStatus
  observations:     string | null
  // Stats (vue garage_stats)
  staff_count:         number
  buses_in_garage:     number
  companies_served:    number
  quotes_pending:      number
  ots_in_progress:     number
  cost_this_month:     number
  cost_total:          number
  created_at:          string
}

export interface PartsItem {
  part_name:  string
  qty:        number
  unit_price: number
  total:      number
  from_stock: boolean
  available:  boolean
}

export interface MaintenanceQuote {
  id:                      string
  quote_number:            string
  garage_id:               string
  garage_name:             string
  bus_id:                  string
  bus_registration:        string
  bus_company_id:          string
  bus_company_name:        string
  created_by:              string
  created_by_name:         string
  maintenance_type:        string
  urgency_level:           UrgencyLevel
  title:                   string
  problem_description:     string
  proposed_solution:       string | null
  labor_hours:             number
  labor_hourly_rate:       number
  labor_cost:              number
  parts_items:             PartsItem[]
  parts_cost:              number
  total_estimated_cost:    number
  observations:            string | null
  photos_urls:             string[]
  mileage:                 number | null
  status:                  QuoteStatus
  submitted_at:            string | null
  submitted_to_name:       string | null
  validated_by_name:       string | null
  validated_at:            string | null
  rejection_reason:        string | null
  work_order_id:           string | null
  planned_start_date:      string | null
  estimated_duration_days: number | null
  created_at:              string
}

export interface GarageStaffMember {
  id:             string
  garage_id:      string
  user_id:        string
  role_in_garage: 'chef_garage' | 'mecanicien' | 'aide_mecanicien' | 'technicien'
  assigned_at:    string
  is_active:      boolean
  notes:          string | null
  user?: {
    full_name: string
    email:     string
  }
}
