/*
  # Allow agent_colis and superviseur_colis to read chauffeurs

  1. Security
    - Add SELECT policy on `users` table for agent_colis and superviseur_colis roles
    - Restricted to rows where role = 'chauffeur'
    - Required so the parcel form can search and select a driver

  2. Important notes
    - Only exposes chauffeur rows, not other staff or clients
    - Does not change any existing policies
*/

CREATE POLICY "agent_colis_select_chauffeurs"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('agent_colis', 'superviseur_colis'))
    AND role = 'chauffeur'
  );
