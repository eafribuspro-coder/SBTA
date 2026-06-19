/*
  # Fix bus_expenses INSERT policy — allow comptable role

  ## Problem
  The existing INSERT policy on bus_expenses only allows admin, chauffeur, and chef_garage.
  The comptable role gets a 403 RLS error when trying to insert a new charge.

  ## Changes
  - Drop the existing INSERT policy
  - Recreate it with comptable included
*/

DROP POLICY IF EXISTS "Chauffeur can insert bus expenses" ON bus_expenses;

CREATE POLICY "Staff can insert bus expenses"
  ON bus_expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() = ANY (ARRAY['admin', 'chauffeur', 'chef_garage', 'comptable', 'gestionnaire'])
  );
