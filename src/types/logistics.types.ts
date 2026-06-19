export type AlertLevel = 'green' | 'orange' | 'red' | 'blue' | 'gray'

export type DocumentStatus =
  | 'valide'
  | 'proche_echeance'
  | 'expire'
  | 'renouvele'
  | 'inactif'

export type PlateStatus =
  | 'provisoire'
  | 'definitive'
  | 'attente_carte_grise'
  | 'carte_grise_disponible'

export type PlateType = 'provisoire' | 'definitive'

export interface ServiceType {
  id:                  string
  name:                string
  validity_months:     number
  auto_renew:          boolean
  default_amount:      number
  default_provider_id: string | null
  observation:         string | null
  is_active:           boolean
  created_at:          string
  updated_at:          string
  default_provider_name?: string | null
}

export interface ServiceTypeInput {
  name:                string
  validity_months:     number
  auto_renew:          boolean
  default_amount:      number
  default_provider_id: string | null
  observation:         string | null
  is_active:           boolean
}

export interface Provider {
  id:           string
  name:         string
  service_type: string | null
  contact:      string | null
  phone:        string | null
  email:        string | null
  address:      string | null
  rates:        string | null
  observation:  string | null
  is_active:    boolean
  created_at:   string
  updated_at:   string
}

export interface ProviderInput {
  name:         string
  service_type: string | null
  contact:      string | null
  phone:        string | null
  email:        string | null
  address:      string | null
  rates:        string | null
  observation:  string | null
  is_active:    boolean
}

export interface Vehicle {
  id:                  string
  bus_id:              string | null
  company_id:          string | null
  registration_number: string | null
  provisional_number:  string | null
  brand:               string | null
  model:               string | null
  total_seats:         number | null
  circulation_date:    string | null
  chassis_number:      string | null
  carte_grise_number:  string | null
  plate_status:        PlateStatus
  observation:         string | null
  created_at:          string
  updated_at:          string
  company_name?:       string | null
  company_code?:       string | null
}

export interface VehicleInput {
  bus_id:              string | null
  company_id:          string | null
  registration_number: string | null
  provisional_number:  string | null
  brand:               string | null
  model:               string | null
  total_seats:         number | null
  circulation_date:    string | null
  chassis_number:      string | null
  carte_grise_number:  string | null
  plate_status:        PlateStatus
  observation:         string | null
}

export interface VehicleDocument {
  id:                   string
  vehicle_id:           string | null
  service_type_id:      string | null
  service_type_name:    string
  provider_id:          string | null
  provider_name:        string | null
  year_concerned:       number | null
  issue_date:           string | null
  expiry_date:          string | null
  amount:               number
  document_url:         string | null
  status:               DocumentStatus
  is_current:           boolean
  previous_document_id: string | null
  observation:          string | null
  created_by:           string | null
  created_at:           string
  updated_at:           string
  vehicle?:             Vehicle | null
}

export interface VehicleDocumentInput {
  vehicle_id:        string | null
  service_type_id:   string | null
  service_type_name: string
  provider_id:       string | null
  provider_name:     string | null
  year_concerned:    number | null
  issue_date:        string | null
  expiry_date:       string | null
  amount:            number
  document_url:      string | null
  observation:       string | null
}

export interface VehiclePlate {
  id:                    string
  vehicle_id:            string | null
  plate_type:            PlateType
  plate_number:          string
  recepisse_date:        string | null
  recepisse_expiry:      string | null
  recepisse_url:         string | null
  carte_grise_number:    string | null
  carte_grise_issue_date:    string | null
  carte_grise_received_date: string | null
  carte_grise_url:       string | null
  is_active:             boolean
  replaced_at:           string | null
  replaced_by_plate_id:  string | null
  changed_by:            string | null
  observation:           string | null
  created_at:            string
}

export interface ProvisionalPlateInput {
  plate_number:     string
  recepisse_date:   string | null
  recepisse_expiry: string | null
  recepisse_url:    string | null
  observation:      string | null
}

export interface DefinitivePlateInput {
  plate_number:              string
  carte_grise_number:        string | null
  carte_grise_issue_date:    string | null
  carte_grise_received_date: string | null
  carte_grise_url:           string | null
  observation:               string | null
}

export interface DocumentAlert {
  document:  VehicleDocument
  level:     AlertLevel
  daysLeft:  number
  threshold: 90 | 60 | 30 | 15 | 7 | 0
  message:   string
}
