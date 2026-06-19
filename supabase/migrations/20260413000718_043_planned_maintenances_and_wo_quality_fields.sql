/*
  # Création de planned_maintenances + colonnes qualité sur maintenance_work_orders

  ## Contexte
  Les pages du chef de garage ont besoin de :
  1. Une table planned_maintenances pour planifier les maintenances préventives
  2. Des colonnes quality_* sur maintenance_work_orders pour le contrôle qualité

  ## Changements

  ### Nouvelle table : planned_maintenances
  - `id` (uuid)
  - `bus_id` (uuid → buses)
  - `scheduled_date` (date)
  - `maintenance_type` (text)
  - `notes` (text nullable)
  - `status` (text : planifie | en_cours | termine)
  - `created_by` (uuid → users)
  - `created_at` (timestamptz)

  ### Colonnes ajoutées sur maintenance_work_orders
  - `quality_check_passed` (boolean)
  - `quality_checklist` (jsonb)
  - `quality_notes` (text)
  - `quality_photos` (text[])
  - `quality_checked_at` (timestamptz)
  - `quality_rejection_reason` (text)

  ## Sécurité
  - RLS activée sur planned_maintenances
  - Politique pour admin et chef_garage
*/

CREATE TABLE IF NOT EXISTS planned_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid REFERENCES buses(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  maintenance_type text NOT NULL DEFAULT 'vidange',
  notes text,
  status text DEFAULT 'planifie' CHECK (status IN ('planifie', 'en_cours', 'termine')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planned_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chef garage and admin can view planned maintenances"
  ON planned_maintenances FOR SELECT
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage', 'mecanicien', 'planificateur'));

CREATE POLICY "Chef garage and admin can insert planned maintenances"
  ON planned_maintenances FOR INSERT
  TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

CREATE POLICY "Chef garage and admin can update planned maintenances"
  ON planned_maintenances FOR UPDATE
  TO authenticated
  USING (public.get_user_role() IN ('admin', 'chef_garage'))
  WITH CHECK (public.get_user_role() IN ('admin', 'chef_garage'));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_check_passed') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_check_passed boolean DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_checklist') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_checklist jsonb DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_notes') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_notes text DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_photos') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_photos text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_checked_at') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_checked_at timestamptz DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maintenance_work_orders' AND column_name = 'quality_rejection_reason') THEN
    ALTER TABLE maintenance_work_orders ADD COLUMN quality_rejection_reason text DEFAULT NULL;
  END IF;
END $$;
