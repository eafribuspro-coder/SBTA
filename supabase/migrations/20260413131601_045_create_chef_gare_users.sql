/*
  # Create Chef de Gare Users

  ## Summary
  Creates 4 chef_gare test users (one per active station) with proper auth.users entries
  and assigns them as station managers.

  ## New Users
  - chefgare.abobo@sbta.ci → Gare Abobo
  - chefgare.adjame@sbta.ci → Gare Adjamé
  - chefgare.bouake@sbta.ci → Gare Bouaké
  - chefgare.korhogo@sbta.ci → Gare Korhogo
*/

DO $$
DECLARE
  v_abobo_id uuid;
  v_adjame_id uuid;
  v_bouake_id uuid;
  v_korhogo_id uuid;
  v_new_id uuid;
BEGIN
  -- Helper: get or create auth user
  -- Abobo
  SELECT id INTO v_abobo_id FROM auth.users WHERE email = 'chefgare.abobo@sbta.ci';
  IF v_abobo_id IS NULL THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_new_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'chefgare.abobo@sbta.ci',
      crypt('ChefGare2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"full_name":"Koné Issouf"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      false, '', '', '', ''
    );
    v_abobo_id := v_new_id;
  END IF;

  -- Adjame
  SELECT id INTO v_adjame_id FROM auth.users WHERE email = 'chefgare.adjame@sbta.ci';
  IF v_adjame_id IS NULL THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_new_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'chefgare.adjame@sbta.ci',
      crypt('ChefGare2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"full_name":"Touré Fatima"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      false, '', '', '', ''
    );
    v_adjame_id := v_new_id;
  END IF;

  -- Bouake
  SELECT id INTO v_bouake_id FROM auth.users WHERE email = 'chefgare.bouake@sbta.ci';
  IF v_bouake_id IS NULL THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_new_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'chefgare.bouake@sbta.ci',
      crypt('ChefGare2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"full_name":"Diallo Mamadou"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      false, '', '', '', ''
    );
    v_bouake_id := v_new_id;
  END IF;

  -- Korhogo
  SELECT id INTO v_korhogo_id FROM auth.users WHERE email = 'chefgare.korhogo@sbta.ci';
  IF v_korhogo_id IS NULL THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_user_meta_data, raw_app_meta_data,
      is_super_admin, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_new_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'chefgare.korhogo@sbta.ci',
      crypt('ChefGare2026!', gen_salt('bf')),
      now(), now(), now(),
      '{"full_name":"Coulibaly Sékou"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      false, '', '', '', ''
    );
    v_korhogo_id := v_new_id;
  END IF;

  -- Upsert into public users table
  INSERT INTO users (id, email, full_name, role, is_active, phone)
  VALUES
    (v_abobo_id,   'chefgare.abobo@sbta.ci',   'Koné Issouf',       'chef_gare', true, '+225 07 11 22 33'),
    (v_adjame_id,  'chefgare.adjame@sbta.ci',   'Touré Fatima',      'chef_gare', true, '+225 07 22 33 44'),
    (v_bouake_id,  'chefgare.bouake@sbta.ci',   'Diallo Mamadou',    'chef_gare', true, '+225 07 33 44 55'),
    (v_korhogo_id, 'chefgare.korhogo@sbta.ci',  'Coulibaly Sékou',   'chef_gare', true, '+225 07 44 55 66')
  ON CONFLICT (id) DO UPDATE SET role = 'chef_gare', is_active = true;

  -- Assign as station managers
  UPDATE stations SET station_manager_id = v_abobo_id
  WHERE id = '60112270-26a7-4f15-af4e-8010eb1deeeb';

  UPDATE stations SET station_manager_id = v_adjame_id
  WHERE id = 'be221fd9-0d42-4f94-89de-096bbf85f803';

  UPDATE stations SET station_manager_id = v_bouake_id
  WHERE id = '0e4a0b9f-3956-4680-84c6-e867954d9fae';

  UPDATE stations SET station_manager_id = v_korhogo_id
  WHERE id = '34365d3f-d65a-435f-b8b1-550c1e79ca2f';

END $$;
