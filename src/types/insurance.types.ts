export type InsuranceStatus =
  | 'actif'
  | 'proche_echeance'
  | 'expire'
  | 'renouvele'
  | 'inactif'

export interface VehicleInsurance {
  id:                  string
  bus_id:              string | null
  company_id:          string | null
  vehicle_type:        string | null
  registration_number: string | null
  assureur:            string
  policy_number:       string | null
  effect_date:         string
  expiry_date:         string
  periode:             string | null
  amount:              number
  edition_month:       string | null
  observation:         string | null
  document_url:        string | null
  status:              InsuranceStatus
  renewed_from_id:     string | null
  is_current:          boolean
  created_by:          string | null
  created_at:          string
  updated_at:          string
  company_name?:       string | null
  company_code?:       string | null
}

export interface InsuranceInput {
  bus_id:              string | null
  company_id:          string | null
  vehicle_type:        string | null
  registration_number: string | null
  assureur:            string
  policy_number:       string | null
  effect_date:         string
  expiry_date:         string
  periode:             string | null
  amount:              number
  edition_month:       string | null
  observation:         string | null
  document_url:        string | null
  status:              InsuranceStatus
}

export type InsurerType =
  | 'automobile'
  | 'transport'
  | 'sante'
  | 'vie'
  | 'multirisque'
  | 'autre'

export type InsurerStatus = 'actif' | 'inactif'

export interface Insurer {
  id:                 string
  name:               string
  acronym:            string | null
  approval_number:    string | null
  type:               InsurerType
  status:             InsurerStatus
  contact_last_name:  string | null
  contact_first_name: string | null
  contact_role:       string | null
  phone_primary:      string | null
  phone_secondary:    string | null
  whatsapp:           string | null
  email:              string | null
  website:            string | null
  created_by:         string | null
  created_at:         string
  updated_at:         string
}

export interface InsurerInput {
  name:               string
  acronym:            string | null
  approval_number:    string | null
  type:               InsurerType
  status:             InsurerStatus
  contact_last_name:  string | null
  contact_first_name: string | null
  contact_role:       string | null
  phone_primary:      string | null
  phone_secondary:    string | null
  whatsapp:           string | null
  email:              string | null
  website:            string | null
}

export type AlertLevel = 'green' | 'orange' | 'red' | 'blue' | 'gray'

export interface InsuranceAlert {
  insurance:  VehicleInsurance
  level:      AlertLevel
  daysLeft:   number
  threshold:  60 | 30 | 7 | 0
  message:    string
}
