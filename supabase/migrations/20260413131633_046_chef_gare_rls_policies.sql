/*
  # RLS Policies for Chef de Gare

  ## Summary
  Adds RLS SELECT/UPDATE policies allowing chef_gare role to access:
  - schedules, stations, buses, users, counters, reservations, routes, cities, companies
*/

-- Schedules: chef_gare can see all schedules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'chef_gare can view schedules') THEN
    CREATE POLICY "chef_gare can view schedules" ON schedules FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedules' AND policyname = 'chef_gare can update schedule status') THEN
    CREATE POLICY "chef_gare can update schedule status" ON schedules FOR UPDATE TO authenticated
      USING (get_my_role() = 'chef_gare') WITH CHECK (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Stations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stations' AND policyname = 'chef_gare can view stations') THEN
    CREATE POLICY "chef_gare can view stations" ON stations FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Buses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buses' AND policyname = 'chef_gare can view buses') THEN
    CREATE POLICY "chef_gare can view buses" ON buses FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'chef_gare can view users') THEN
    CREATE POLICY "chef_gare can view users" ON users FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Counters
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'counters' AND policyname = 'chef_gare can view counters') THEN
    CREATE POLICY "chef_gare can view counters" ON counters FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Reservations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reservations' AND policyname = 'chef_gare can view reservations') THEN
    CREATE POLICY "chef_gare can view reservations" ON reservations FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Routes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'routes' AND policyname = 'chef_gare can view routes') THEN
    CREATE POLICY "chef_gare can view routes" ON routes FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Cities
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cities' AND policyname = 'chef_gare can view cities') THEN
    CREATE POLICY "chef_gare can view cities" ON cities FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;

-- Companies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'chef_gare can view companies') THEN
    CREATE POLICY "chef_gare can view companies" ON companies FOR SELECT TO authenticated USING (get_my_role() = 'chef_gare');
  END IF;
END $$;
