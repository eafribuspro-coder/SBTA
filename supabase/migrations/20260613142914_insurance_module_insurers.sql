-- Insurers (compagnies d'assurance) management for Responsable Service Assurance

CREATE TABLE IF NOT EXISTS insurers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  acronym           text,
  approval_number   text,
  type              text NOT NULL DEFAULT 'automobile'
                      CHECK (type = ANY (ARRAY['automobile','transport','sante','vie','multirisque','autre'])),
  status            text NOT NULL DEFAULT 'actif'
                      CHECK (status = ANY (ARRAY['actif','inactif'])),
  contact_last_name  text,
  contact_first_name text,
  contact_role       text,
  phone_primary      text,
  phone_secondary    text,
  whatsapp           text,
  email              text,
  website            text,
  created_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insurers_status ON insurers(status);
CREATE INDEX IF NOT EXISTS idx_insurers_name ON insurers(name);

ALTER TABLE insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assurance_select_insurers"
  ON insurers FOR SELECT
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

CREATE POLICY "assurance_insert_insurers"
  ON insurers FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin'])
    AND created_by = auth.uid()
  );

CREATE POLICY "assurance_update_insurers"
  ON insurers FOR UPDATE
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']))
  WITH CHECK (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

CREATE POLICY "assurance_delete_insurers"
  ON insurers FOR DELETE
  TO authenticated
  USING (get_my_role_assurance() = ANY (ARRAY['responsable_assurance','admin']));

NOTIFY pgrst, 'reload schema';
