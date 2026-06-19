/*
  # Allow comptable role to insert and update vehicle_expenses

  The existing INSERT and UPDATE policies on vehicle_expenses only allowed
  charge_achat, admin, and daf roles. The comptable role was excluded,
  causing a permission error when saving a new expense from the comptable UI.

  Changes:
  - Drop and recreate INSERT policy to include 'comptable'
  - Drop and recreate UPDATE policy to include 'comptable'
*/

DROP POLICY IF EXISTS "charge_achat and admin can insert expenses" ON vehicle_expenses;
DROP POLICY IF EXISTS "charge_achat and admin can update expenses" ON vehicle_expenses;

CREATE POLICY "charge_achat admin daf comptable can insert expenses"
  ON vehicle_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = ANY (ARRAY['charge_achat','admin','daf','comptable'])
  );

CREATE POLICY "charge_achat admin daf comptable can update expenses"
  ON vehicle_expenses
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) = ANY (ARRAY['charge_achat','admin','daf','comptable'])
  )
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) = ANY (ARRAY['charge_achat','admin','daf','comptable'])
  );
