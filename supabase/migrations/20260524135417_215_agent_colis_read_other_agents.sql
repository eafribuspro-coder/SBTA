/*
  # Allow agent_colis to read other agent_colis users

  1. Problem
    - When printing a parcel ticket, the agent_colis needs to display the
      destination station's agent_colis phone number in "VILLE DES:"
    - Current RLS only lets agent_colis read chauffeur records
    - The Supabase join `station_agent_colis_id(phone)` returns null because
      the agent_colis cannot read other agent_colis rows

  2. Fix
    - Add a SELECT policy on users table for agent_colis and superviseur_colis
      roles to read other agent_colis and superviseur_colis users
    - This enables the ticket header to show destination agent phone numbers

  3. Security
    - Limited to agent_colis and superviseur_colis roles only
    - Only allows reading other agent_colis / superviseur_colis records
    - Does not grant access to admin, client, or other sensitive roles
*/

CREATE POLICY "agent_colis_read_other_colis_agents"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('agent_colis', 'superviseur_colis'))
    AND (role IN ('agent_colis', 'superviseur_colis'))
  );
