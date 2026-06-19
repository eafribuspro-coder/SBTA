/*
# Add Gérant Principal role

1. Changes
   - Insert 'gerant_principal' into the `roles` table with display_name.
   - Update CHECK constraints on `users` and `employees` tables to include gerant_principal
     plus existing roles carburant and charge_achat.

2. Security
   - No RLS changes needed.
*/

-- 1. Insert role
INSERT INTO roles (name, display_name, description)
VALUES ('gerant_principal', 'Gérant Principal', 'Gérant Principal — supervision globale des opérations')
ON CONFLICT (name) DO NOTHING;

-- 2. Update CHECK constraint on users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'admin','agent_colis','carburant','charge_achat','chauffeur',
    'chef_garage','chef_gare','client','comptable','daf',
    'gestionnaire','guichetier','mecanicien','planificateur',
    'pompiste','rh','superviseur_colis','gerant_principal'
  )
);

-- 3. Update CHECK constraint on employees table
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (
  role IN (
    'admin','agent_colis','carburant','charge_achat','chauffeur',
    'chef_garage','chef_gare','client','comptable','daf',
    'gestionnaire','guichetier','mecanicien','planificateur',
    'pompiste','rh','superviseur_colis','gerant_principal'
  )
);
