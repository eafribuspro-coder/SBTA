-- Logistics module: service types, providers, vehicle fiche, documents, plate history

-- Role helper
CREATE OR REPLACE FUNCTION get_my_role_logistique()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- 1. Service types
CREATE TABLE IF NOT EXISTS logistics_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  validity_months integer NOT NULL DEFAULT 12,
  auto_renew boolean NOT NULL DEFAULT false,
  default_amount numeric(14,2) NOT NULL DEFAULT 0,
  default_provider_id uuid,
  observation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Providers
CREATE TABLE IF NOT EXISTS logistics_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_type text,
  contact text,
  phone text,
  email text,
  address text,
  rates text,
  observation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logistics_service_types
  ADD CONSTRAINT logistics_service_types_provider_fk
  FOREIGN KEY (default_provider_id) REFERENCES logistics_providers(id) ON DELETE SET NULL;

-- 3. Vehicle logistics fiche
CREATE TABLE IF NOT EXISTS vehicle_logistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid REFERENCES buses(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  registration_number text,
  provisional_number text,
  brand text,
  model text,
  total_seats integer,
  circulation_date date,
  chassis_number text,
  carte_grise_number text,
  plate_status text NOT NULL DEFAULT 'provisoire'
    CHECK (plate_status IN ('provisoire','definitive','attente_carte_grise','carte_grise_disponible')),
  observation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Vehicle documents (with renewal history chain)
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicle_logistics(id) ON DELETE CASCADE,
  service_type_id uuid REFERENCES logistics_service_types(id) ON DELETE SET NULL,
  service_type_name text NOT NULL,
  provider_id uuid REFERENCES logistics_providers(id) ON DELETE SET NULL,
  provider_name text,
  year_concerned integer,
  issue_date date,
  expiry_date date,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  document_url text,
  status text NOT NULL DEFAULT 'valide'
    CHECK (status IN ('valide','proche_echeance','expire','renouvele','inactif')),
  is_current boolean NOT NULL DEFAULT true,
  previous_document_id uuid REFERENCES vehicle_documents(id) ON DELETE SET NULL,
  observation text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Vehicle plates (provisional + definitive, history)
CREATE TABLE IF NOT EXISTS vehicle_plates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicle_logistics(id) ON DELETE CASCADE,
  plate_type text NOT NULL DEFAULT 'provisoire'
    CHECK (plate_type IN ('provisoire','definitive')),
  plate_number text NOT NULL,
  -- provisional fields
  recepisse_date date,
  recepisse_expiry date,
  recepisse_url text,
  -- definitive fields
  carte_grise_number text,
  carte_grise_issue_date date,
  carte_grise_received_date date,
  carte_grise_url text,
  is_active boolean NOT NULL DEFAULT true,
  replaced_at timestamptz,
  replaced_by_plate_id uuid REFERENCES vehicle_plates(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  observation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A bus cannot have two active plates at the same time
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_plates_one_active_per_vehicle
  ON vehicle_plates (vehicle_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expiry ON vehicle_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_plates_vehicle ON vehicle_plates(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logistics_bus ON vehicle_logistics(bus_id);

-- Enable RLS
ALTER TABLE logistics_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_plates ENABLE ROW LEVEL SECURITY;

-- Policies helper expression: get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin'])

-- logistics_service_types
CREATE POLICY "lst_select" ON logistics_service_types FOR SELECT TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lst_insert" ON logistics_service_types FOR INSERT TO authenticated
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lst_update" ON logistics_service_types FOR UPDATE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lst_delete" ON logistics_service_types FOR DELETE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

-- logistics_providers
CREATE POLICY "lp_select" ON logistics_providers FOR SELECT TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lp_insert" ON logistics_providers FOR INSERT TO authenticated
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lp_update" ON logistics_providers FOR UPDATE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "lp_delete" ON logistics_providers FOR DELETE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

-- vehicle_logistics
CREATE POLICY "vl_select" ON vehicle_logistics FOR SELECT TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vl_insert" ON vehicle_logistics FOR INSERT TO authenticated
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vl_update" ON vehicle_logistics FOR UPDATE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vl_delete" ON vehicle_logistics FOR DELETE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

-- vehicle_documents
CREATE POLICY "vd_select" ON vehicle_documents FOR SELECT TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vd_insert" ON vehicle_documents FOR INSERT TO authenticated
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vd_update" ON vehicle_documents FOR UPDATE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vd_delete" ON vehicle_documents FOR DELETE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

-- vehicle_plates (no delete policy for provisional plates -> only insert/select/update)
CREATE POLICY "vp_select" ON vehicle_plates FOR SELECT TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vp_insert" ON vehicle_plates FOR INSERT TO authenticated
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));
CREATE POLICY "vp_update" ON vehicle_plates FOR UPDATE TO authenticated
  USING (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']))
  WITH CHECK (get_my_role_logistique() = ANY(ARRAY['responsable_logistique','admin']));

NOTIFY pgrst, 'reload schema';
