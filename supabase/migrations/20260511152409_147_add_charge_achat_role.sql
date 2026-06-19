/*
  # Add "charge_achat" role

  Adds the "Chargé d'Achat" (Purchasing Officer) role to the system.

  ## Changes
  1. `users` table — DROP and re-add CHECK constraint to include 'charge_achat'
  2. `employees` table — DROP and re-add CHECK constraint to include 'charge_achat'

  ## Notes
  - The role is considered a direction/support profile (requires company, no station)
  - Existing data is not affected
*/

-- Update CHECK constraint on users.role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
  'admin','daf','comptable','rh','gestionnaire',
  'chauffeur','guichetier','chef_garage','mecanicien',
  'planificateur','pompiste','chef_gare',
  'agent_colis','superviseur_colis',
  'charge_achat',
  'client'
));

-- Update CHECK constraint on employees.role
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role IN (
  'admin','daf','comptable','rh','gestionnaire',
  'chauffeur','guichetier','chef_garage','mecanicien',
  'planificateur','pompiste','chef_gare',
  'agent_colis','superviseur_colis',
  'charge_achat'
));
