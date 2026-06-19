/*
  # Vehicle Expenses — Source Column + Visibility Separation

  ## Problem
  Both "Chargé Achat" and "Comptable" roles insert into the same
  `vehicle_expenses` table. There was no way to distinguish which
  role created an expense, so Comptable was seeing Chargé Achat
  entries and vice-versa.

  ## Changes

  ### 1. New column: vehicle_expenses.source
  - Values: 'charge_achat' | 'comptable'
  - Default: 'charge_achat' (safe fallback)
  - Backfilled from created_by → users.role

  ### 2. Updated RLS SELECT policy
  - charge_achat, admin, daf: see only source='charge_achat' entries
  - comptable: sees only source='comptable' entries
  - admin/daf see both (override)

  ### 3. Updated RLS INSERT policy
  - charge_achat: can only insert with source='charge_achat'
  - comptable: can only insert with source='comptable'
*/

-- 1. Add source column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vehicle_expenses' AND column_name = 'source'
  ) THEN
    ALTER TABLE vehicle_expenses ADD COLUMN source text NOT NULL DEFAULT 'charge_achat';
  END IF;
END $$;

-- 2. Backfill: mark existing rows based on creator's role
UPDATE vehicle_expenses ve
SET source = CASE
  WHEN (SELECT role FROM users WHERE id = ve.created_by) = 'comptable' THEN 'comptable'
  ELSE 'charge_achat'
END
WHERE ve.created_by IS NOT NULL;

-- 3. Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'vehicle_expenses' AND constraint_name = 'vehicle_expenses_source_check'
  ) THEN
    ALTER TABLE vehicle_expenses
      ADD CONSTRAINT vehicle_expenses_source_check
      CHECK (source IN ('charge_achat', 'comptable'));
  END IF;
END $$;

-- 4. Drop old permissive RLS policies
DROP POLICY IF EXISTS "charge_achat admin daf can read all expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat admin daf comptable can insert expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat admin daf comptable can update expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat and admin can delete expenses" ON vehicle_expenses;

-- Catch any legacy names
DROP POLICY IF EXISTS "charge_achat_admin_daf_can_read" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat_admin_daf_comptable_can_insert" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat_admin_daf_comptable_can_update" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat_admin_can_delete" ON vehicle_expenses;

-- 5. New SELECT: role-based source filtering
--    admin/daf see everything
--    charge_achat sees only source='charge_achat'
--    comptable sees only source='comptable' AND own company
CREATE POLICY "admin daf see all vehicle expenses"
  ON vehicle_expenses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'daf')
  );

CREATE POLICY "charge_achat sees own source expenses"
  ON vehicle_expenses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'charge_achat'
    AND source = 'charge_achat'
  );

CREATE POLICY "gestionnaire sees charge_achat expenses own company"
  ON vehicle_expenses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'gestionnaire'
    AND source = 'charge_achat'
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "comptable sees own company comptable expenses"
  ON vehicle_expenses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'comptable'
    AND source = 'comptable'
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- 6. INSERT: each role can only create entries matching their source
CREATE POLICY "charge_achat inserts charge_achat expenses"
  ON vehicle_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'charge_achat'
    AND source = 'charge_achat'
  );

CREATE POLICY "comptable inserts comptable expenses"
  ON vehicle_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'comptable'
    AND source = 'comptable'
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "admin daf insert any expense"
  ON vehicle_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'daf')
  );

-- 7. UPDATE: same source restriction
CREATE POLICY "charge_achat updates own source expenses"
  ON vehicle_expenses FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'charge_achat'
    AND source = 'charge_achat'
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'charge_achat'
    AND source = 'charge_achat'
  );

CREATE POLICY "comptable updates own company comptable expenses"
  ON vehicle_expenses FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'comptable'
    AND source = 'comptable'
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = 'comptable'
    AND source = 'comptable'
    AND company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "admin daf update any expense"
  ON vehicle_expenses FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'daf')
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'daf')
  );

-- 8. DELETE: charge_achat and admin only (on their source)
CREATE POLICY "charge_achat deletes own source expenses"
  ON vehicle_expenses FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'charge_achat'
    AND source = 'charge_achat'
  );

CREATE POLICY "admin daf delete any expense"
  ON vehicle_expenses FOR DELETE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'daf')
  );
