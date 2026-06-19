
/*
  # Fix Auth: Password Rehash + chef_gare Role + Chef Gare Test User

  ## Problems Fixed

  1. **Password hash cost too low** — all seed users had bcrypt cost=6 ($2a$06$).
     GoTrue (Supabase Auth) expects cost=10. Rehashing all 16 users with cost=10
     using pgcrypto's crypt() to ensure compatibility.

  2. **chef_gare missing from users_role_check** — the CHECK constraint on
     public.users.role did not include 'chef_gare', preventing any chef_gare
     user from being inserted/updated.

  3. **Missing chef_gare test user** — no auth user or public profile existed
     for the chef_gare role. Adding chefgare1@sbta.ci with full auth setup.

  4. **chef_gare missing from roles table** — added so fetchProfile/permissions
     resolve correctly after login.

  ## New Users
  - chefgare1@sbta.ci / ChefGare123! → role: chef_gare

  ## Security
  - No RLS changes
  - All passwords rehashed with standard bcrypt cost=10
*/

-- ============================================================
-- 1. REHASH ALL PASSWORDS WITH BCRYPT COST=10
-- ============================================================
UPDATE auth.users SET encrypted_password = crypt('Admin123!',    gen_salt('bf', 10)) WHERE email = 'admin@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Daf123!',      gen_salt('bf', 10)) WHERE email = 'daf@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Comptable123!',gen_salt('bf', 10)) WHERE email = 'comptable@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Planif123!',   gen_salt('bf', 10)) WHERE email = 'planif1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Garage123!',   gen_salt('bf', 10)) WHERE email = 'chefgarage1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Meca123!',     gen_salt('bf', 10)) WHERE email = 'meca1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Pompiste123!', gen_salt('bf', 10)) WHERE email = 'pompiste1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Guichet123!',  gen_salt('bf', 10)) WHERE email = 'guichet1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Chauffeur123!',gen_salt('bf', 10)) WHERE email = 'chauffeur1@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Chauffeur123!',gen_salt('bf', 10)) WHERE email = 'chauffeur2@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Chauffeur123!',gen_salt('bf', 10)) WHERE email = 'chauffeur3@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Gest123!',     gen_salt('bf', 10)) WHERE email = 'gest.express@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Gest123!',     gen_salt('bf', 10)) WHERE email = 'gest.premium@sbta.ci';
UPDATE auth.users SET encrypted_password = crypt('Client123!',   gen_salt('bf', 10)) WHERE email = 'client01@gmail.com';
UPDATE auth.users SET encrypted_password = crypt('Client123!',   gen_salt('bf', 10)) WHERE email = 'client02@gmail.com';
UPDATE auth.users SET encrypted_password = crypt('Client123!',   gen_salt('bf', 10)) WHERE email = 'client03@gmail.com';

-- ============================================================
-- 2. ADD chef_gare TO users_role_check CONSTRAINT
-- ============================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role = ANY (ARRAY[
    'admin', 'daf', 'comptable', 'gestionnaire',
    'chauffeur', 'guichetier', 'chef_garage', 'chef_gare',
    'mecanicien', 'planificateur', 'pompiste', 'client'
  ]));

-- ============================================================
-- 3. ADD chef_gare TO roles TABLE
-- ============================================================
INSERT INTO public.roles (name, display_name, description, level)
VALUES ('chef_gare', 'Chef de Gare', 'Gestion des départs et arrivées en station', 6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. CREATE chef_gare TEST USER IN auth.users
--    (confirmed_at is a generated column, omit it)
-- ============================================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) VALUES (
  '00000000-0000-0000-0008-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'chefgare1@sbta.ci',
  crypt('ChefGare123!', gen_salt('bf', 10)),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Koné CHEF GARE Abidjan"}',
  NOW(), NOW(), false, false
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. CREATE IDENTITY FOR chef_gare USER
-- ============================================================
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0008-000000000001',
  'chefgare1@sbta.ci',
  jsonb_build_object(
    'sub',            '00000000-0000-0000-0008-000000000001',
    'email',          'chefgare1@sbta.ci',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  NOW(), NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. CREATE public.users PROFILE FOR chef_gare USER
-- ============================================================
INSERT INTO public.users (
  id, email, full_name, first_name, last_name,
  role, status, company_id, is_active, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0008-000000000001',
  'chefgare1@sbta.ci',
  'Koné CHEF GARE Abidjan',
  'Koné',
  'CHEF GARE Abidjan',
  'chef_gare',
  'active',
  (SELECT id FROM public.companies WHERE code = 'EXPRESS' LIMIT 1),
  true,
  NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE id = '00000000-0000-0000-0008-000000000001'
);

-- ============================================================
-- 7. ENSURE ALL EXISTING IDENTITIES HAVE email_verified = true
-- ============================================================
UPDATE auth.identities
SET identity_data = identity_data || '{"email_verified": true}'::jsonb
WHERE provider = 'email'
  AND (identity_data->>'email_verified')::boolean IS NOT TRUE;
