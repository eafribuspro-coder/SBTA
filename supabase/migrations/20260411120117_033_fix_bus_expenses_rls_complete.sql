/*
  # Complete RLS fix for bus_expenses

  ## Problems
  1. No DELETE policy — comptable cannot delete pending charges
  2. UPDATE policy only covers comptable — admin cannot update/validate

  ## Changes
  - Add DELETE policy for comptable and admin (only on pending rows)
  - Expand UPDATE policy to include admin
*/

DROP POLICY IF EXISTS "Comptable can validate bus expenses" ON bus_expenses;

CREATE POLICY "Staff can update bus expenses"
  ON bus_expenses
  FOR UPDATE
  TO authenticated
  USING (get_user_role() = ANY (ARRAY['admin', 'comptable']))
  WITH CHECK (get_user_role() = ANY (ARRAY['admin', 'comptable']));

CREATE POLICY "Comptable can delete pending bus expenses"
  ON bus_expenses
  FOR DELETE
  TO authenticated
  USING (
    get_user_role() = ANY (ARRAY['admin', 'comptable'])
    AND status = 'pending'
  );
