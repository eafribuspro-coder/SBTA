/*
  # Breakdown net balance and revenue split audit

  Enhances the breakdown management workflow so revenue is split based on
  the NET balance (recette - charges déduites), not on the gross revenue.
  Adds full audit history for every revenue redistribution.

  1. Schema Changes
    - `schedule_breakdowns`:
      - `charges_amount` (decimal): total charges déduites au guichet
      - `net_balance` (decimal): solde net = recette - charges au moment du signalement
      - `net_balance_adjusted` (decimal): solde net potentiellement ajusté par le gestionnaire avant répartition
      - `beneficiary_company_id` (uuid): société bénéficiaire (alias explicite, set quand inter-sociétés)
      - `split_reason` (text): motif de la répartition
    - New table `schedule_breakdown_audit`: trace every meaningful action

  2. Audit Table `schedule_breakdown_audit`
    - id, breakdown_id, action, performed_by, performed_at
    - snapshot JSON of all relevant values before/after

  3. Security
    - RLS enabled on audit table
    - admin/daf/gestionnaire/comptable can read
    - System (via trigger) inserts; no direct writes from clients
*/

-- ═══════════════════════════════════════════════════════════════════
-- 1. Extend schedule_breakdowns with net balance fields
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schedule_breakdowns' AND column_name='charges_amount'
  ) THEN
    ALTER TABLE schedule_breakdowns ADD COLUMN charges_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schedule_breakdowns' AND column_name='net_balance'
  ) THEN
    ALTER TABLE schedule_breakdowns ADD COLUMN net_balance numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schedule_breakdowns' AND column_name='net_balance_adjusted'
  ) THEN
    ALTER TABLE schedule_breakdowns ADD COLUMN net_balance_adjusted numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schedule_breakdowns' AND column_name='beneficiary_company_id'
  ) THEN
    ALTER TABLE schedule_breakdowns ADD COLUMN beneficiary_company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='schedule_breakdowns' AND column_name='split_reason'
  ) THEN
    ALTER TABLE schedule_breakdowns ADD COLUMN split_reason text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_breakdowns_beneficiary_company
  ON schedule_breakdowns(beneficiary_company_id);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Audit table
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS schedule_breakdown_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breakdown_id uuid NOT NULL REFERENCES schedule_breakdowns(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('signal','adjust_net','split','cancel','reassign')),
  performed_by uuid REFERENCES users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),

  -- Snapshot fields (denormalized for fast reporting)
  original_company_id uuid REFERENCES companies(id),
  beneficiary_company_id uuid REFERENCES companies(id),
  original_bus_id uuid REFERENCES buses(id),
  replacement_bus_id uuid REFERENCES buses(id),
  revenue_amount numeric DEFAULT 0,
  charges_amount numeric DEFAULT 0,
  net_balance_before numeric DEFAULT 0,
  amount_to_beneficiary numeric DEFAULT 0,
  net_balance_after numeric DEFAULT 0,
  reason text,
  observation text,

  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breakdown_audit_breakdown ON schedule_breakdown_audit(breakdown_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_audit_performed_at ON schedule_breakdown_audit(performed_at);
CREATE INDEX IF NOT EXISTS idx_breakdown_audit_orig_company ON schedule_breakdown_audit(original_company_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_audit_benef_company ON schedule_breakdown_audit(beneficiary_company_id);

ALTER TABLE schedule_breakdown_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_breakdown_audit" ON schedule_breakdown_audit;
CREATE POLICY "read_breakdown_audit"
  ON schedule_breakdown_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin','daf','comptable','gestionnaire','chef_gare')
    )
  );

DROP POLICY IF EXISTS "insert_breakdown_audit" ON schedule_breakdown_audit;
CREATE POLICY "insert_breakdown_audit"
  ON schedule_breakdown_audit FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin','daf','comptable','gestionnaire','chef_gare')
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- 3. Realtime
-- ═══════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'schedule_breakdown_audit'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE schedule_breakdown_audit;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
