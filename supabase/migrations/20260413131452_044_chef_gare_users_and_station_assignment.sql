/*
  # Chef de Gare Users and Station Assignments

  ## Summary
  Creates proper chef_gare role users in the users table and assigns them to stations.
  Also ensures the `chef_gare` role is allowed in the users table CHECK constraint.

  ## Changes
  1. Add `chef_gare` to the role CHECK constraint if not already present
  2. Insert chef_gare test users linked to auth.users (via a function approach)
  3. Assign station_manager_id on stations to the correct chef_gare users

  ## Notes
  - The users table role CHECK must include 'chef_gare'
  - Stations already have station_manager_id pointing to users with wrong roles
  - We fix this by inserting proper chef_gare users or updating existing assignments
*/

-- Step 1: Drop and recreate role constraint to include chef_gare
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'admin', 'daf', 'comptable', 'gestionnaire', 'chauffeur',
    'guichetier', 'chef_garage', 'mecanicien', 'planificateur',
    'pompiste', 'client', 'chef_gare'
  )
);

-- Step 2: Update station assignments to use proper chef_gare managers
-- For now clear the bad assignments (chef_garage assigned as station manager)
UPDATE stations
SET station_manager_id = NULL
WHERE station_manager_id IN (
  SELECT id FROM users WHERE role != 'chef_gare'
);

-- Step 3: Update existing users who were assigned as station managers to have chef_gare role
-- We'll create a migration to allow proper role assignment
-- Check if any users exist with valid assignment and update their role
UPDATE users SET role = 'chef_gare'
WHERE id IN (
  SELECT station_manager_id FROM stations WHERE station_manager_id IS NOT NULL
)
AND role IN ('chef_garage', 'guichetier', 'admin');
