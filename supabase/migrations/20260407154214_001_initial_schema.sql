/*
  # SBTA - Initial Database Schema

  1. Tables Created
    - companies: Sociétés de transport (filiales de la holding)
    - users: Personnel et clients (personnel en holding, gestionnaires liés aux sociétés)
    - cities: Villes desservies
    - amenities: Équipements disponibles dans les bus
    - bus_seat_config: Configurations de sièges
    - stations: Gares et terminaux
    - counters: Guichets dans les gares
    - boarding_points: Points d'embarquement dans les gares
    - buses: Flotte de bus (appartenant aux sociétés)
    - routes: Itinéraires entre villes
    - schedules: Planification des voyages
    - reservations: Réservations clients
    - payments: Paiements des réservations
    - driver_hours_log: Journalisation des heures de conduite
    - driver_reviews: Avis sur les chauffeurs
    - driver_performance: Performance agrégée des chauffeurs
    - loyalty_rewards_catalog: Catalogue des récompenses fidélité
    - loyalty_points_log: Historique des points fidélité
    - loyalty_redemptions: Utilisations des points fidélité
    - fuel_vouchers: Bons de carburant
    - fuel_estimations: Estimations de consommation carburant
    - fuel_logs: Ravitaillements effectués
    - bus_expenses: Charges diverses sur les bus
    - breakdown_reports: Signalements de pannes
    - maintenance_diagnostics: Diagnostics de maintenance
    - spare_parts: Pièces détachées
    - spare_parts_suppliers: Fournisseurs de pièces
    - spare_parts_purchase_orders: Bons de commande de pièces
    - spare_parts_stock_movements: Mouvements de stock
    - maintenance_work_orders: Ordres de travail maintenance
    - incidents: Incidents divers
    - station_display_boards: Tableaux d'affichage en gare

  2. Security
    - Enable RLS on all tables
    - Policies will be created in migration 002
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. COMPANIES (Sociétés de transport)
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  logo_url text,
  address text,
  phone text,
  email text,
  siret text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. USERS (Personnel + Clients)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('admin', 'daf', 'comptable', 'gestionnaire', 'chauffeur', 'guichetier', 'chef_garage', 'mecanicien', 'planificateur', 'pompiste', 'client')),
  avatar_url text,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,

  -- Champs fidélité (pour clients)
  loyalty_points integer DEFAULT 0,
  loyalty_tier text DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  total_trips integer DEFAULT 0,

  -- Champs chauffeur
  driver_license_number text,
  driver_license_expiry date,
  driver_total_hours decimal(10,2) DEFAULT 0,
  driver_avg_rating decimal(3,2) DEFAULT 0,
  driver_total_reviews integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. CITIES (Villes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  region text,
  country text DEFAULT 'Côte d''Ivoire',
  latitude decimal(10,8),
  longitude decimal(11,8),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. AMENITIES (Équipements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS amenities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  icon text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. BUS_SEAT_CONFIG (Configurations de sièges)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bus_seat_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  total_seats integer NOT NULL,
  rows integer NOT NULL,
  columns integer NOT NULL,
  layout_map jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bus_seat_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. STATIONS (Gares)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  address text,
  latitude decimal(10,8),
  longitude decimal(11,8),
  phone text,
  facilities jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. COUNTERS (Guichets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS counters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  counter_number text NOT NULL,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE counters ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. BOARDING_POINTS (Points d'embarquement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS boarding_points (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boarding_points ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 9. BUSES (Bus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS buses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  registration_number text UNIQUE NOT NULL,
  model text,
  manufacturer text,
  year integer,
  seat_config_id uuid REFERENCES bus_seat_config(id) ON DELETE SET NULL,
  total_seats integer NOT NULL,
  amenities_ids uuid[],
  status text DEFAULT 'disponible' CHECK (status IN ('disponible', 'en_service', 'panne_route', 'reception_garage', 'diagnostic', 'attente_ot', 'maintenance', 'controle_qualite', 'hors_service')),
  mileage decimal(10,2) DEFAULT 0,
  last_maintenance_date date,
  next_maintenance_due date,
  fill_rate_current decimal(5,2) DEFAULT 0,
  fill_rate_avg_30d decimal(5,2) DEFAULT 0,
  fill_rate_avg_90d decimal(5,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE buses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 10. ROUTES (Itinéraires)
-- ============================================================================
CREATE TABLE IF NOT EXISTS routes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  origin_city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  destination_city_id uuid REFERENCES cities(id) ON DELETE CASCADE,
  distance_km decimal(8,2),
  estimated_duration_minutes integer,
  base_price decimal(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 11. SCHEDULES (Planification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  departure_station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  arrival_station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  departure_datetime timestamptz NOT NULL,
  arrival_datetime timestamptz NOT NULL,
  boarding_point_id uuid REFERENCES boarding_points(id) ON DELETE SET NULL,
  status text DEFAULT 'planifie' CHECK (status IN ('planifie', 'en_cours', 'termine', 'annule')),
  seats_available integer,
  seats_reserved integer DEFAULT 0,
  price decimal(10,2),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 12. RESERVATIONS (Réservations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id uuid REFERENCES schedules(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  passenger_name text NOT NULL,
  passenger_phone text,
  seat_numbers text[],
  total_seats integer NOT NULL,
  total_price decimal(10,2) NOT NULL,
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirmee', 'annulee', 'terminee')),
  payment_status text DEFAULT 'en_attente' CHECK (payment_status IN ('en_attente', 'payee', 'remboursee')),
  booking_reference text UNIQUE,
  qr_code text,
  booked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. PAYMENTS (Paiements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  payment_method text CHECK (payment_method IN ('especes', 'carte', 'mobile_money', 'virement')),
  payment_reference text,
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'reussie', 'echouee', 'remboursee')),
  processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 14. DRIVER_HOURS_LOG (Heures de conduite)
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_hours_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  total_hours decimal(5,2),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_hours_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 15. DRIVER_REVIEWS (Avis chauffeurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id uuid REFERENCES users(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 16. DRIVER_PERFORMANCE (Performance chauffeurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_performance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id uuid REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  total_trips integer DEFAULT 0,
  total_hours decimal(10,2) DEFAULT 0,
  avg_rating decimal(3,2) DEFAULT 0,
  total_reviews integer DEFAULT 0,
  last_trip_date timestamptz,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE driver_performance ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 17. LOYALTY_REWARDS_CATALOG (Catalogue récompenses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loyalty_rewards_catalog (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  reward_type text CHECK (reward_type IN ('discount', 'free_trip', 'upgrade', 'voucher', 'gift')),
  reward_value decimal(10,2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loyalty_rewards_catalog ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 18. LOYALTY_POINTS_LOG (Historique points)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loyalty_points_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES users(id) ON DELETE CASCADE,
  points_change integer NOT NULL,
  reason text,
  reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loyalty_points_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 19. LOYALTY_REDEMPTIONS (Utilisations points)
-- ============================================================================
CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id uuid REFERENCES users(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES loyalty_rewards_catalog(id) ON DELETE SET NULL,
  points_used integer NOT NULL,
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'validee', 'utilisee', 'annulee')),
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE loyalty_redemptions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 20. FUEL_VOUCHERS (Bons de carburant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_vouchers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_number text UNIQUE NOT NULL,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  estimated_liters decimal(10,2),
  estimated_amount decimal(10,2),
  actual_liters decimal(10,2),
  actual_amount decimal(10,2),
  fuel_price_per_liter decimal(10,2),
  status text DEFAULT 'genere' CHECK (status IN ('genere', 'valide_comptable', 'utilise', 'annule')),
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE fuel_vouchers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 21. FUEL_ESTIMATIONS (Estimations carburant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_estimations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id uuid REFERENCES routes(id) ON DELETE CASCADE,
  bus_model text,
  avg_consumption_per_100km decimal(5,2),
  estimated_liters decimal(10,2),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_estimations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 22. FUEL_LOGS (Ravitaillements)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fuel_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id uuid REFERENCES fuel_vouchers(id) ON DELETE SET NULL,
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  liters decimal(10,2) NOT NULL,
  amount decimal(10,2) NOT NULL,
  fuel_price_per_liter decimal(10,2),
  odometer_reading decimal(10,2),
  station_name text,
  processed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 23. BUS_EXPENSES (Charges bus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bus_expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  expense_type text CHECK (expense_type IN ('assurance', 'taxes', 'peage', 'lavage', 'autres')),
  amount decimal(10,2) NOT NULL,
  description text,
  expense_date date DEFAULT CURRENT_DATE,
  receipt_url text,
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'validee', 'rejetee')),
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bus_expenses ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 24. BREAKDOWN_REPORTS (Signalements de pannes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS breakdown_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  breakdown_type text CHECK (breakdown_type IN ('mecanique', 'electrique', 'pneumatique', 'carrosserie', 'autres')),
  severity text CHECK (severity IN ('faible', 'moyenne', 'critique')),
  description text NOT NULL,
  location text,
  photos_urls text[],
  status text DEFAULT 'signale' CHECK (status IN ('signale', 'recu_garage', 'en_diagnostic', 'resolu')),
  reported_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE breakdown_reports ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 25. MAINTENANCE_DIAGNOSTICS (Diagnostics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS maintenance_diagnostics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  breakdown_report_id uuid REFERENCES breakdown_reports(id) ON DELETE SET NULL,
  diagnosed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  diagnosis_summary text NOT NULL,
  estimated_cost decimal(10,2),
  estimated_duration_hours integer,
  spare_parts_needed jsonb,
  priority text CHECK (priority IN ('faible', 'moyenne', 'haute', 'urgente')),
  status text DEFAULT 'en_cours' CHECK (status IN ('en_cours', 'termine', 'attente_pieces')),
  diagnosed_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE maintenance_diagnostics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 26. SPARE_PARTS (Pièces détachées)
-- ============================================================================
CREATE TABLE IF NOT EXISTS spare_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_number text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  unit_price decimal(10,2),
  stock_quantity integer DEFAULT 0,
  min_stock_level integer DEFAULT 0,
  location text,
  supplier_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE spare_parts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 27. SPARE_PARTS_SUPPLIERS (Fournisseurs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS spare_parts_suppliers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE spare_parts_suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 28. SPARE_PARTS_PURCHASE_ORDERS (Bons de commande)
-- ============================================================================
CREATE TABLE IF NOT EXISTS spare_parts_purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number text UNIQUE NOT NULL,
  supplier_id uuid REFERENCES spare_parts_suppliers(id) ON DELETE SET NULL,
  order_date date DEFAULT CURRENT_DATE,
  expected_delivery_date date,
  total_amount decimal(10,2),
  status text DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'validee', 'livree', 'annulee')),
  items jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE spare_parts_purchase_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 29. SPARE_PARTS_STOCK_MOVEMENTS (Mouvements de stock)
-- ============================================================================
CREATE TABLE IF NOT EXISTS spare_parts_stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  part_id uuid REFERENCES spare_parts(id) ON DELETE CASCADE,
  movement_type text CHECK (movement_type IN ('entree', 'sortie', 'ajustement')),
  quantity integer NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE spare_parts_stock_movements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 30. MAINTENANCE_WORK_ORDERS (Ordres de travail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS maintenance_work_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_number text UNIQUE NOT NULL,
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  diagnostic_id uuid REFERENCES maintenance_diagnostics(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  work_description text NOT NULL,
  estimated_cost decimal(10,2),
  actual_cost decimal(10,2),
  estimated_hours integer,
  actual_hours decimal(5,2),
  spare_parts_used jsonb,
  status text DEFAULT 'attente_validation' CHECK (status IN ('attente_validation', 'valide_comptable', 'en_cours', 'en_controle', 'termine', 'annule')),
  priority text CHECK (priority IN ('faible', 'moyenne', 'haute', 'urgente')),
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 31. INCIDENTS (Incidents)
-- ============================================================================
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type text CHECK (incident_type IN ('accident', 'vol', 'vandalisme', 'altercation', 'autres')),
  schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL,
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  description text NOT NULL,
  location text,
  severity text CHECK (severity IN ('faible', 'moyenne', 'grave')),
  photos_urls text[],
  police_report_number text,
  status text DEFAULT 'ouvert' CHECK (status IN ('ouvert', 'en_traitement', 'clos')),
  reported_at timestamptz DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 32. STATION_DISPLAY_BOARDS (Tableaux d'affichage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS station_display_boards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  board_name text NOT NULL,
  display_order integer,
  schedules_to_show integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE station_display_boards ENABLE ROW LEVEL SECURITY;

-- Add FK constraint for spare_parts.supplier_id after spare_parts_suppliers is created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'spare_parts_supplier_id_fkey'
  ) THEN
    ALTER TABLE spare_parts
    ADD CONSTRAINT spare_parts_supplier_id_fkey
    FOREIGN KEY (supplier_id) REFERENCES spare_parts_suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_buses_company_id ON buses(company_id);
CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);
CREATE INDEX IF NOT EXISTS idx_schedules_departure_datetime ON schedules(departure_datetime);
CREATE INDEX IF NOT EXISTS idx_schedules_bus_id ON schedules(bus_id);
CREATE INDEX IF NOT EXISTS idx_schedules_driver_id ON schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_schedule_id ON reservations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_fuel_vouchers_bus_id ON fuel_vouchers(bus_id);
CREATE INDEX IF NOT EXISTS idx_fuel_vouchers_status ON fuel_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_bus_id ON breakdown_reports(bus_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_reports_status ON breakdown_reports(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_work_orders_bus_id ON maintenance_work_orders(bus_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_work_orders_status ON maintenance_work_orders(status);
