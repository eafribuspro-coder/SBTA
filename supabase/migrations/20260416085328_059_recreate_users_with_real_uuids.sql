/*
  # Recreate all seeded users with proper random UUIDs

  ## Problem
  All seeded users have manually crafted sequential UUIDs like:
    00000000-0000-0000-0001-000000000001
  
  Supabase GoTrue 2026 cannot authenticate these users, returning
  "Database error querying schema" (HTTP 500). A user with a real 
  random UUID logs in successfully, confirming the root cause.

  ## Strategy
  1. Temporarily drop ALL FK constraints from public tables pointing to users
  2. For each seeded user: delete old auth record, insert new with real UUID
  3. Update public.users.id
  4. Update all FK references in all child tables
  5. Restore all FK constraints
  6. Set proper passwords

  ## Credentials after migration
  - admin@sbta.ci / Admin123!
  - daf@sbta.ci / Daf123!
  - comptable@sbta.ci / Comptable123!
  - guichet1@sbta.ci / Guichet123!
  - chefgarage1@sbta.ci / Garage123!
  - meca1@sbta.ci / Meca123!
  - pompiste1@sbta.ci / Pompiste123!
  - planif1@sbta.ci / Planif123!
  - chauffeur1/2/3@sbta.ci / Chauffeur123!
  - gest.express/premium@sbta.ci / Gestionnaire123!
  - chefgare1@sbta.ci / ChefGare123!
  - client01/02/03@gmail.com / Client123!
*/

DO $$
DECLARE
  v_email text;
  v_old_id uuid;
  v_new_id uuid;
  v_old_password text;
  v_email_confirmed_at timestamptz;
  v_raw_app_meta_data jsonb;
  v_raw_user_meta_data jsonb;
  v_created_at timestamptz;

  seeded_emails text[] := ARRAY[
    'admin@sbta.ci', 'daf@sbta.ci', 'comptable@sbta.ci',
    'guichet1@sbta.ci', 'chefgarage1@sbta.ci', 'meca1@sbta.ci',
    'pompiste1@sbta.ci', 'planif1@sbta.ci',
    'chauffeur1@sbta.ci', 'chauffeur2@sbta.ci', 'chauffeur3@sbta.ci',
    'gest.express@sbta.ci', 'gest.premium@sbta.ci',
    'chefgare1@sbta.ci',
    'client01@gmail.com', 'client02@gmail.com', 'client03@gmail.com'
  ];

BEGIN

  -- ================================================================
  -- STEP 1: Drop ALL FK constraints from public tables -> public.users
  -- ================================================================
  ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
  ALTER TABLE public.breakdown_reports DROP CONSTRAINT IF EXISTS breakdown_reports_driver_id_fkey;
  ALTER TABLE public.breakdown_reports DROP CONSTRAINT IF EXISTS breakdown_reports_reported_by_fkey;
  ALTER TABLE public.bus_expenses DROP CONSTRAINT IF EXISTS bus_expenses_created_by_fkey;
  ALTER TABLE public.bus_expenses DROP CONSTRAINT IF EXISTS bus_expenses_validated_by_fkey;
  ALTER TABLE public.bus_seat_config DROP CONSTRAINT IF EXISTS bus_seat_config_last_modified_by_fkey;
  ALTER TABLE public.counters DROP CONSTRAINT IF EXISTS counters_assigned_user_id_fkey;
  ALTER TABLE public.driver_hours_log DROP CONSTRAINT IF EXISTS driver_hours_log_driver_id_fkey;
  ALTER TABLE public.driver_performance DROP CONSTRAINT IF EXISTS driver_performance_driver_id_fkey;
  ALTER TABLE public.driver_performance_badges DROP CONSTRAINT IF EXISTS driver_performance_badges_driver_id_fkey;
  ALTER TABLE public.driver_reviews DROP CONSTRAINT IF EXISTS driver_reviews_customer_id_fkey;
  ALTER TABLE public.driver_reviews DROP CONSTRAINT IF EXISTS driver_reviews_driver_id_fkey;
  ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_processed_by_fkey;
  ALTER TABLE public.fuel_vouchers DROP CONSTRAINT IF EXISTS fuel_vouchers_driver_id_fkey;
  ALTER TABLE public.fuel_vouchers DROP CONSTRAINT IF EXISTS fuel_vouchers_used_by_fkey;
  ALTER TABLE public.fuel_vouchers DROP CONSTRAINT IF EXISTS fuel_vouchers_validated_by_fkey;
  ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_reported_by_fkey;
  ALTER TABLE public.loyalty_points_log DROP CONSTRAINT IF EXISTS loyalty_points_log_customer_id_fkey;
  ALTER TABLE public.loyalty_redemptions DROP CONSTRAINT IF EXISTS loyalty_redemptions_customer_id_fkey;
  ALTER TABLE public.loyalty_redemptions DROP CONSTRAINT IF EXISTS loyalty_redemptions_validated_by_fkey;
  ALTER TABLE public.maintenance_diagnostics DROP CONSTRAINT IF EXISTS maintenance_diagnostics_diagnosed_by_fkey;
  ALTER TABLE public.maintenance_work_orders DROP CONSTRAINT IF EXISTS maintenance_work_orders_assigned_to_fkey;
  ALTER TABLE public.maintenance_work_orders DROP CONSTRAINT IF EXISTS maintenance_work_orders_created_by_fkey;
  ALTER TABLE public.maintenance_work_orders DROP CONSTRAINT IF EXISTS maintenance_work_orders_validated_by_fkey;
  ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey;
  ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_updated_by_fkey;
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_processed_by_fkey;
  ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_booked_by_fkey;
  ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_customer_id_fkey;
  ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_copilot_id_fkey;
  ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_created_by_fkey;
  ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_driver_id_fkey;
  ALTER TABLE public.spare_parts_purchase_orders DROP CONSTRAINT IF EXISTS spare_parts_purchase_orders_created_by_fkey;
  ALTER TABLE public.spare_parts_purchase_orders DROP CONSTRAINT IF EXISTS spare_parts_purchase_orders_validated_by_fkey;
  ALTER TABLE public.spare_parts_stock_movements DROP CONSTRAINT IF EXISTS spare_parts_stock_movements_performed_by_fkey;
  ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;
  -- Also drop FK from public.users -> auth.users
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

  -- ================================================================
  -- STEP 2: Process each seeded user
  -- ================================================================
  FOREACH v_email IN ARRAY seeded_emails
  LOOP
    SELECT id, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at
    INTO v_old_id, v_old_password, v_email_confirmed_at, v_raw_app_meta_data, v_raw_user_meta_data, v_created_at
    FROM auth.users WHERE email = v_email;

    CONTINUE WHEN v_old_id IS NULL;
    CONTINUE WHEN v_old_id::text NOT LIKE '00000000-0000-0000-0%';

    v_new_id := gen_random_uuid();
    RAISE NOTICE 'Migrating % : % -> %', v_email, v_old_id, v_new_id;

    -- Clean up auth child records
    DELETE FROM auth.identities WHERE user_id = v_old_id;
    DELETE FROM auth.sessions WHERE user_id = v_old_id;
    DELETE FROM auth.one_time_tokens WHERE user_id = v_old_id;
    DELETE FROM auth.mfa_factors WHERE user_id = v_old_id;

    -- Update public.users ID
    UPDATE public.users SET id = v_new_id WHERE id = v_old_id;

    -- Update all FK references in public tables
    UPDATE public.activity_logs SET user_id = v_new_id WHERE user_id = v_old_id;
    UPDATE public.breakdown_reports SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.breakdown_reports SET reported_by = v_new_id WHERE reported_by = v_old_id;
    UPDATE public.bus_expenses SET created_by = v_new_id WHERE created_by = v_old_id;
    UPDATE public.bus_expenses SET validated_by = v_new_id WHERE validated_by = v_old_id;
    UPDATE public.bus_seat_config SET last_modified_by = v_new_id WHERE last_modified_by = v_old_id;
    UPDATE public.counters SET assigned_user_id = v_new_id WHERE assigned_user_id = v_old_id;
    UPDATE public.driver_hours_log SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.driver_performance SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.driver_performance_badges SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.driver_reviews SET customer_id = v_new_id WHERE customer_id = v_old_id;
    UPDATE public.driver_reviews SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.fuel_logs SET processed_by = v_new_id WHERE processed_by = v_old_id;
    UPDATE public.fuel_vouchers SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.fuel_vouchers SET used_by = v_new_id WHERE used_by = v_old_id;
    UPDATE public.fuel_vouchers SET validated_by = v_new_id WHERE validated_by = v_old_id;
    UPDATE public.incidents SET reported_by = v_new_id WHERE reported_by = v_old_id;
    UPDATE public.loyalty_points_log SET customer_id = v_new_id WHERE customer_id = v_old_id;
    UPDATE public.loyalty_redemptions SET customer_id = v_new_id WHERE customer_id = v_old_id;
    UPDATE public.loyalty_redemptions SET validated_by = v_new_id WHERE validated_by = v_old_id;
    UPDATE public.maintenance_diagnostics SET diagnosed_by = v_new_id WHERE diagnosed_by = v_old_id;
    UPDATE public.maintenance_work_orders SET assigned_to = v_new_id WHERE assigned_to = v_old_id;
    UPDATE public.maintenance_work_orders SET created_by = v_new_id WHERE created_by = v_old_id;
    UPDATE public.maintenance_work_orders SET validated_by = v_new_id WHERE validated_by = v_old_id;
    UPDATE public.organizations SET created_by = v_new_id WHERE created_by = v_old_id;
    UPDATE public.organizations SET updated_by = v_new_id WHERE updated_by = v_old_id;
    UPDATE public.payments SET processed_by = v_new_id WHERE processed_by = v_old_id;
    UPDATE public.reservations SET booked_by = v_new_id WHERE booked_by = v_old_id;
    UPDATE public.reservations SET customer_id = v_new_id WHERE customer_id = v_old_id;
    UPDATE public.schedules SET copilot_id = v_new_id WHERE copilot_id = v_old_id;
    UPDATE public.schedules SET created_by = v_new_id WHERE created_by = v_old_id;
    UPDATE public.schedules SET driver_id = v_new_id WHERE driver_id = v_old_id;
    UPDATE public.spare_parts_purchase_orders SET created_by = v_new_id WHERE created_by = v_old_id;
    UPDATE public.spare_parts_purchase_orders SET validated_by = v_new_id WHERE validated_by = v_old_id;
    UPDATE public.spare_parts_stock_movements SET performed_by = v_new_id WHERE performed_by = v_old_id;
    UPDATE public.user_sessions SET user_id = v_new_id WHERE user_id = v_old_id;

    -- Delete old auth.users record
    DELETE FROM auth.users WHERE id = v_old_id;

    -- Insert new auth.users with real random UUID
    INSERT INTO auth.users (
      id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_sso_user, is_anonymous,
      instance_id, confirmation_token, recovery_token,
      email_change_token_new, email_change_token_current,
      phone_change_token, reauthentication_token,
      phone_change, email_change_confirm_status
    ) VALUES (
      v_new_id, 'authenticated', 'authenticated', v_email, v_old_password,
      v_email_confirmed_at,
      COALESCE(v_raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
      COALESCE(v_raw_user_meta_data, '{}'::jsonb),
      v_created_at, NOW(), false, false,
      '00000000-0000-0000-0000-000000000000'::uuid, '', '', '', '', '', '', '', 0
    );

    -- Create new identity
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_new_id, v_email,
      jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email', NOW(), NOW(), NOW()
    );

  END LOOP;

  -- ================================================================
  -- STEP 3: Restore all FK constraints
  -- ================================================================
  ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.breakdown_reports ADD CONSTRAINT breakdown_reports_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.breakdown_reports ADD CONSTRAINT breakdown_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.bus_expenses ADD CONSTRAINT bus_expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.bus_expenses ADD CONSTRAINT bus_expenses_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.bus_seat_config ADD CONSTRAINT bus_seat_config_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.counters ADD CONSTRAINT counters_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.driver_hours_log ADD CONSTRAINT driver_hours_log_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.driver_performance ADD CONSTRAINT driver_performance_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.driver_performance_badges ADD CONSTRAINT driver_performance_badges_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.driver_reviews ADD CONSTRAINT driver_reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.driver_reviews ADD CONSTRAINT driver_reviews_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.fuel_logs ADD CONSTRAINT fuel_logs_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.fuel_vouchers ADD CONSTRAINT fuel_vouchers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.fuel_vouchers ADD CONSTRAINT fuel_vouchers_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.fuel_vouchers ADD CONSTRAINT fuel_vouchers_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.incidents ADD CONSTRAINT incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.loyalty_points_log ADD CONSTRAINT loyalty_points_log_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.loyalty_redemptions ADD CONSTRAINT loyalty_redemptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.loyalty_redemptions ADD CONSTRAINT loyalty_redemptions_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.maintenance_diagnostics ADD CONSTRAINT maintenance_diagnostics_diagnosed_by_fkey FOREIGN KEY (diagnosed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.maintenance_work_orders ADD CONSTRAINT maintenance_work_orders_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.maintenance_work_orders ADD CONSTRAINT maintenance_work_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.maintenance_work_orders ADD CONSTRAINT maintenance_work_orders_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.payments ADD CONSTRAINT payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.reservations ADD CONSTRAINT reservations_booked_by_fkey FOREIGN KEY (booked_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.reservations ADD CONSTRAINT reservations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  ALTER TABLE public.schedules ADD CONSTRAINT schedules_copilot_id_fkey FOREIGN KEY (copilot_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.schedules ADD CONSTRAINT schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.schedules ADD CONSTRAINT schedules_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.spare_parts_purchase_orders ADD CONSTRAINT spare_parts_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.spare_parts_purchase_orders ADD CONSTRAINT spare_parts_purchase_orders_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.spare_parts_stock_movements ADD CONSTRAINT spare_parts_stock_movements_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  ALTER TABLE public.user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

  RAISE NOTICE 'Migration complete. All seeded users now have real random UUIDs.';

END $$;

-- Set proper passwords
UPDATE auth.users SET encrypted_password = extensions.crypt('Admin123!', extensions.gen_salt('bf', 10)) WHERE email = 'admin@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Daf123!', extensions.gen_salt('bf', 10)) WHERE email = 'daf@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Comptable123!', extensions.gen_salt('bf', 10)) WHERE email = 'comptable@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Guichet123!', extensions.gen_salt('bf', 10)) WHERE email = 'guichet1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Garage123!', extensions.gen_salt('bf', 10)) WHERE email = 'chefgarage1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Meca123!', extensions.gen_salt('bf', 10)) WHERE email = 'meca1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Pompiste123!', extensions.gen_salt('bf', 10)) WHERE email = 'pompiste1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Planif123!', extensions.gen_salt('bf', 10)) WHERE email = 'planif1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Chauffeur123!', extensions.gen_salt('bf', 10)) WHERE email IN ('chauffeur1@sbta.ci', 'chauffeur2@sbta.ci', 'chauffeur3@sbta.ci');
UPDATE auth.users SET encrypted_password = extensions.crypt('Gestionnaire123!', extensions.gen_salt('bf', 10)) WHERE email IN ('gest.express@sbta.ci', 'gest.premium@sbta.ci');
UPDATE auth.users SET encrypted_password = extensions.crypt('ChefGare123!', extensions.gen_salt('bf', 10)) WHERE email = 'chefgare1@sbta.ci';
UPDATE auth.users SET encrypted_password = extensions.crypt('Client123!', extensions.gen_salt('bf', 10)) WHERE email IN ('client01@gmail.com', 'client02@gmail.com', 'client03@gmail.com');

NOTIFY pgrst, 'reload schema';
