/*
  # Add 'carburant' to users role check constraint

  The users table has a CHECK constraint listing allowed roles.
  'carburant' was missing, causing an error when creating a user account
  with that role from admin or the user management interface.
*/

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (
    role = ANY (ARRAY[
      'admin', 'daf', 'comptable', 'rh', 'gestionnaire', 'chauffeur',
      'guichetier', 'chef_garage', 'mecanicien', 'planificateur', 'pompiste',
      'chef_gare', 'agent_colis', 'superviseur_colis', 'charge_achat',
      'carburant', 'client'
    ])
  );
