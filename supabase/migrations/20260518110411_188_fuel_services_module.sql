/*
  # Module Service Carburant

  ## Objectif
  Permettre à l'administrateur de gérer les services carburant et d'affecter
  des agents carburant à ces services.

  ## Nouvelles tables

  ### `fuel_services`
  Représente un service carburant (entité organisationnelle gérant le carburant).
  - `id` UUID primary key
  - `name` — Nom du service
  - `code` — Code unique du service
  - `company_id` — Société rattachée (FK → companies)
  - `address`, `city`, `region` — Localisation
  - `phone`, `email` — Contacts
  - `manager_name` — Responsable du service
  - `description` — Description libre
  - `is_active` — Statut actif/inactif
  - `created_at`, `updated_at` — Horodatages automatiques

  ### `fuel_service_agents`
  Table de liaison agent carburant ↔ service carburant (N-N).
  - `id` UUID primary key
  - `fuel_service_id` FK → fuel_services
  - `employee_id` FK → employees (rôle carburant uniquement)
  - `assigned_at` — Date d'affectation
  - `assigned_by` — UUID de l'utilisateur qui a effectué l'affectation
  - `is_active` — Affectation active ou non

  ### `fuel_service_audit_logs`
  Traçabilité complète de toutes les actions sur les services carburant.
  - `id`, `fuel_service_id`, `action`, `performed_by`
  - `old_value`, `new_value` (JSONB)
  - `created_at`

  ## Sécurité
  - RLS activé sur les 3 tables
  - Admin : accès total
  - Agent carburant : lecture seule sur ses services assignés
*/

-- ══════════════════════════════════════════════════════════
-- TABLE: fuel_services
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fuel_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  code         text NOT NULL,
  company_id   uuid REFERENCES companies(id) ON DELETE SET NULL,
  address      text DEFAULT '',
  city         text DEFAULT '',
  region       text DEFAULT '',
  phone        text DEFAULT '',
  email        text DEFAULT '',
  manager_name text DEFAULT '',
  description  text DEFAULT '',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fuel_services_code_key ON fuel_services(code);
CREATE INDEX IF NOT EXISTS fuel_services_company_idx ON fuel_services(company_id);
CREATE INDEX IF NOT EXISTS fuel_services_city_idx    ON fuel_services(city);
CREATE INDEX IF NOT EXISTS fuel_services_region_idx  ON fuel_services(region);

-- ══════════════════════════════════════════════════════════
-- TABLE: fuel_service_agents
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fuel_service_agents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_service_id  uuid NOT NULL REFERENCES fuel_services(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at      timestamptz NOT NULL DEFAULT now(),
  assigned_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active        boolean NOT NULL DEFAULT true,
  UNIQUE (fuel_service_id, employee_id)
);

CREATE INDEX IF NOT EXISTS fsa_service_idx  ON fuel_service_agents(fuel_service_id);
CREATE INDEX IF NOT EXISTS fsa_employee_idx ON fuel_service_agents(employee_id);

-- ══════════════════════════════════════════════════════════
-- TABLE: fuel_service_audit_logs
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fuel_service_audit_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_service_id  uuid REFERENCES fuel_services(id) ON DELETE SET NULL,
  action           text NOT NULL,
  performed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_value        jsonb,
  new_value        jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fsal_service_idx ON fuel_service_audit_logs(fuel_service_id);
CREATE INDEX IF NOT EXISTS fsal_created_idx ON fuel_service_audit_logs(created_at DESC);

-- ══════════════════════════════════════════════════════════
-- TRIGGER: auto-update updated_at on fuel_services
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_fuel_service_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_services_updated_at ON fuel_services;
CREATE TRIGGER trg_fuel_services_updated_at
  BEFORE UPDATE ON fuel_services
  FOR EACH ROW EXECUTE FUNCTION update_fuel_service_updated_at();

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════
ALTER TABLE fuel_services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_service_agents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_service_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper: returns role of current user from public.users
CREATE OR REPLACE FUNCTION get_my_role_for_fuel()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ── fuel_services ────────────────────────────────────────
-- Admin: full access
CREATE POLICY "Admin can select fuel_services"
  ON fuel_services FOR SELECT TO authenticated
  USING (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can insert fuel_services"
  ON fuel_services FOR INSERT TO authenticated
  WITH CHECK (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can update fuel_services"
  ON fuel_services FOR UPDATE TO authenticated
  USING  (get_my_role_for_fuel() = 'admin')
  WITH CHECK (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can delete fuel_services"
  ON fuel_services FOR DELETE TO authenticated
  USING (get_my_role_for_fuel() = 'admin');

-- Agent carburant: sees only their assigned services
CREATE POLICY "Agent carburant can select assigned fuel_services"
  ON fuel_services FOR SELECT TO authenticated
  USING (
    get_my_role_for_fuel() = 'carburant'
    AND EXISTS (
      SELECT 1 FROM fuel_service_agents fsa
      JOIN employees e ON e.id = fsa.employee_id
      WHERE fsa.fuel_service_id = fuel_services.id
        AND e.id = (SELECT id FROM employees WHERE id = auth.uid() LIMIT 1)
        AND fsa.is_active = true
    )
  );

-- ── fuel_service_agents ──────────────────────────────────
CREATE POLICY "Admin can select fuel_service_agents"
  ON fuel_service_agents FOR SELECT TO authenticated
  USING (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can insert fuel_service_agents"
  ON fuel_service_agents FOR INSERT TO authenticated
  WITH CHECK (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can update fuel_service_agents"
  ON fuel_service_agents FOR UPDATE TO authenticated
  USING  (get_my_role_for_fuel() = 'admin')
  WITH CHECK (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can delete fuel_service_agents"
  ON fuel_service_agents FOR DELETE TO authenticated
  USING (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Agent carburant can select own assignments"
  ON fuel_service_agents FOR SELECT TO authenticated
  USING (
    get_my_role_for_fuel() = 'carburant'
    AND employee_id = (SELECT id FROM employees WHERE id = auth.uid() LIMIT 1)
  );

-- ── fuel_service_audit_logs ──────────────────────────────
CREATE POLICY "Admin can select audit logs"
  ON fuel_service_audit_logs FOR SELECT TO authenticated
  USING (get_my_role_for_fuel() = 'admin');

CREATE POLICY "Admin can insert audit logs"
  ON fuel_service_audit_logs FOR INSERT TO authenticated
  WITH CHECK (get_my_role_for_fuel() = 'admin');

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
