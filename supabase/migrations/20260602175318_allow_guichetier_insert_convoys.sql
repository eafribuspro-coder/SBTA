/*
  # Allow guichetier to insert convoys

  1. Security Changes
    - Drop existing INSERT policy on `convoys` that only allowed chef_gare and admin
    - Recreate the INSERT policy to also include the guichetier role

  This is needed because the Guichetier module now supports registering convoy departures
  directly from the ticket counter dashboard.
*/

DROP POLICY IF EXISTS "Chef de gare and admin can insert convoys" ON public.convoys;

CREATE POLICY "Chef gare, guichetier and admin can insert convoys"
  ON public.convoys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('chef_gare', 'admin', 'guichetier')
    )
  );
