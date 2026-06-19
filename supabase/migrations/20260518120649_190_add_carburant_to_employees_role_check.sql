/*
  # Add 'carburant' to employees role check constraint

  The employees table has a CHECK constraint listing allowed roles.
  'carburant' was added as a new role but was not included in the constraint,
  causing an error when saving an employee with that role.

  This migration drops the old constraint and recreates it with 'carburant' added.
*/

ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE employees
  ADD CONSTRAINT employees_role_check CHECK (
    role = ANY (ARRAY[
      'admin', 'daf', 'comptable', 'rh', 'gestionnaire', 'chauffeur',
      'guichetier', 'chef_garage', 'mecanicien', 'planificateur', 'pompiste',
      'chef_gare', 'agent_colis', 'superviseur_colis', 'charge_achat', 'carburant'
    ])
  );
