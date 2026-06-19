-- Insurance management module for Responsable Service Assurance

CREATE TABLE IF NOT EXISTS vehicle_insurances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id              uuid REFERENCES buses(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES companies(id) ON DELETE SET NULL,
  vehicle_type        text,
  registration_number text,
  assureur            text NOT NULL,
  policy_number       text,
  effect_date         date NOT NULL,
  expiry_date         date NOT NULL,
  periode             text,
  amount              numeric DEFAULT 0,
  edition_month       text,
  observation         text,
  document_url        text,
  status              text NOT NULL DEFAULT 'actif'
                        CHECK (status = ANY (ARRAY['actif','proche_echeance','expire','renouvele','inactif'])),
  renewed_from_id     uuid REFERENCES vehicle_insurances(id) ON DELETE SET NULL,
  is_current          boolean NOT NULL DEFAULT true,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_insurances_bus ON vehicle_insurances(bus_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurances_company ON vehicle_insurances(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurances_expiry ON vehicle_insurances(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_insurances_current ON vehicle_insurances(is_current);

ALTER TABLE vehicle_insurances ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_role_assurance()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "assurance_select_insurances"
  ON vehicle_insurances FOR SELECT
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

CREATE POLICY "assurance_insert_insurances"
  ON vehicle_insurances FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin'])
    AND created_by = auth.uid()
  );

CREATE POLICY "assurance_update_insurances"
  ON vehicle_insurances FOR UPDATE
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']))
  WITH CHECK (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

CREATE POLICY "assurance_delete_insurances"
  ON vehicle_insurances FOR DELETE
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

-- Storage bucket for insurance documents (jpg, png, pdf)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'insurance-docs',
  'insurance-docs',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','application/pdf'];

CREATE POLICY "Public insurance docs read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'insurance-docs');

CREATE POLICY "Authenticated insurance docs upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'insurance-docs');

CREATE POLICY "Authenticated insurance docs update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'insurance-docs');

NOTIFY pgrst, 'reload schema';
