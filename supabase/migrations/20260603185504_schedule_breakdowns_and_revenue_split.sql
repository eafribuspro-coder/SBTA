/*
  # Schedule breakdowns and inter-company revenue split

  Enables breakdown reporting by Chef de Gare and replacement/revenue-split
  workflow for Gestionnaire, with full audit history.

  1. Schema Changes
    - Extends `schedules.status` constraint to allow 'panne' status
    - Creates `schedule_breakdowns` table storing the complete audit trail
      of each breakdown: initial bus/driver/route/revenue snapshot, the
      replacement bus/driver, the inter-company revenue split, and metadata.

  2. New Table: `schedule_breakdowns`
    - Records every breakdown signal and replacement decision
    - Stores snapshot of trip state at the moment of breakdown
    - Persists revenue split between original company and replacement company
    - Used as source of truth for revenue allocation and reporting

  3. Security
    - Enables RLS on `schedule_breakdowns`
    - Chef de Gare can insert/select breakdowns for their station
    - Gestionnaire can select/update breakdowns for their company (as origin
      or replacement company)
    - Admin/DAF/Comptable have read access to all breakdowns
*/

-- ═══════════════════════════════════════════════════════════════════
-- 1. Extend schedules.status constraint
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedules_status_check') THEN
    ALTER TABLE schedules DROP CONSTRAINT schedules_status_check;
  END IF;
  ALTER TABLE schedules ADD CONSTRAINT schedules_status_check
    CHECK (status = ANY (ARRAY['planifie','en_cours','termine','annule','retard','convoi','panne']));
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Create schedule_breakdowns table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS schedule_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,

  -- Initial bus snapshot
  original_bus_id uuid REFERENCES buses(id),
  original_driver_id uuid REFERENCES users(id),
  original_company_id uuid REFERENCES companies(id),
  station_id uuid REFERENCES stations(id),
  route_id uuid REFERENCES routes(id),
  passengers_count integer NOT NULL DEFAULT 0,
  fill_rate numeric NOT NULL DEFAULT 0,
  revenue_amount numeric NOT NULL DEFAULT 0,

  -- Breakdown report
  breakdown_at timestamptz NOT NULL DEFAULT now(),
  reported_by uuid REFERENCES users(id),
  reason text,
  observations text,

  -- Replacement
  replacement_bus_id uuid REFERENCES buses(id),
  replacement_driver_id uuid REFERENCES users(id),
  replacement_company_id uuid REFERENCES companies(id),
  replacement_route_label text,
  replacement_at timestamptz,
  replaced_by uuid REFERENCES users(id),

  -- Revenue split
  amount_original_company numeric DEFAULT 0,
  amount_replacement_company numeric DEFAULT 0,

  status text NOT NULL DEFAULT 'signalee'
    CHECK (status IN ('signalee','remplace','cloture','annule')),

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breakdowns_schedule ON schedule_breakdowns(schedule_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_original_company ON schedule_breakdowns(original_company_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_replacement_company ON schedule_breakdowns(replacement_company_id);
CREATE INDEX IF NOT EXISTS idx_breakdowns_status ON schedule_breakdowns(status);
CREATE INDEX IF NOT EXISTS idx_breakdowns_breakdown_at ON schedule_breakdowns(breakdown_at);

ALTER TABLE schedule_breakdowns ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS policies
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "chef_gare_insert_breakdowns" ON schedule_breakdowns;
CREATE POLICY "chef_gare_insert_breakdowns"
  ON schedule_breakdowns FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('chef_gare','admin','gestionnaire')
    )
  );

DROP POLICY IF EXISTS "select_breakdowns" ON schedule_breakdowns;
CREATE POLICY "select_breakdowns"
  ON schedule_breakdowns FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin','daf','comptable','chef_gare','gestionnaire')
    )
  );

DROP POLICY IF EXISTS "gestionnaire_update_breakdowns" ON schedule_breakdowns;
CREATE POLICY "gestionnaire_update_breakdowns"
  ON schedule_breakdowns FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('gestionnaire','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('gestionnaire','admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. Trigger to keep updated_at fresh
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_schedule_breakdowns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_breakdowns_updated_at ON schedule_breakdowns;
CREATE TRIGGER trg_schedule_breakdowns_updated_at
  BEFORE UPDATE ON schedule_breakdowns
  FOR EACH ROW EXECUTE FUNCTION set_schedule_breakdowns_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- 5. Enable realtime for notifications
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_breakdowns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_breakdowns;
  END IF;
END $$;
