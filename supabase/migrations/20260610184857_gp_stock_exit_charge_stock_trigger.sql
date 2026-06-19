
/*
  # Automatic financial impact: Stock exits → "Charge stock"
  
  Each stock exit from Gérant Principal automatically generates a charge
  in vehicle_expenses. This charge impacts:
  - Bus charges and margin
  - Company charges and net result
  - Gestionnaire reports
  - DAF financial reports
  
  ## Changes:
  1. Add 'stock_gerant' to vehicle_expenses source CHECK constraint
  2. Create trigger on gp_stock_exits INSERT → vehicle_expenses
  3. Add gp_stock_exit_id column to vehicle_expenses for dedup
  4. Update gestionnaire + DAF RPCs to include 'stock_gerant' source
*/

-- 1. Add 'stock_gerant' source and a FK column for dedup
ALTER TABLE vehicle_expenses
  DROP CONSTRAINT IF EXISTS vehicle_expenses_source_check;

ALTER TABLE vehicle_expenses
  ADD CONSTRAINT vehicle_expenses_source_check
  CHECK (source IN ('charge_achat', 'comptable', 'stock_gerant'));

ALTER TABLE vehicle_expenses
  ADD COLUMN IF NOT EXISTS gp_stock_exit_id uuid UNIQUE REFERENCES gp_stock_exits(id) ON DELETE CASCADE;

-- 2. Trigger function: on gp_stock_exits INSERT, create vehicle_expenses entry
CREATE OR REPLACE FUNCTION public.gp_stock_exit_create_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_registration text;
  v_company_id uuid;
  v_vehicle_id uuid;
  v_article_name text;
BEGIN
  -- Only process if there's a bus assigned
  IF NEW.bus_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get bus info
  SELECT b.registration_number, b.company_id
  INTO v_registration, v_company_id
  FROM buses b
  WHERE b.id = NEW.bus_id;

  IF v_registration IS NULL THEN
    RETURN NEW;
  END IF;

  -- Use company from the exit if bus doesn't have one
  IF v_company_id IS NULL THEN
    v_company_id := NEW.company_id;
  END IF;

  -- If still no company, skip
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get fleet vehicle id if exists
  SELECT fv.id INTO v_vehicle_id
  FROM fleet_vehicles fv
  WHERE fv.registration_number = v_registration
  LIMIT 1;

  -- Get article name
  SELECT a.designation INTO v_article_name
  FROM gp_stock_articles a
  WHERE a.id = NEW.article_id;

  -- Insert the charge (unique on gp_stock_exit_id prevents duplicates)
  INSERT INTO vehicle_expenses (
    company_id, vehicle_id, registration_number, expense_date,
    week_start, description, amount, source, gp_stock_exit_id, created_at
  ) VALUES (
    v_company_id,
    v_vehicle_id,
    v_registration,
    NEW.exit_date,
    date_trunc('week', NEW.exit_date)::date,
    'Charge stock — ' || COALESCE(v_article_name, 'Article'),
    COALESCE(NEW.total_amount, NEW.quantity * NEW.unit_price),
    'stock_gerant',
    NEW.id,
    now()
  )
  ON CONFLICT (gp_stock_exit_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Create the trigger (INSERT only to prevent double-counting)
DROP TRIGGER IF EXISTS trg_gp_stock_exit_create_charge ON gp_stock_exits;
CREATE TRIGGER trg_gp_stock_exit_create_charge
  AFTER INSERT ON gp_stock_exits
  FOR EACH ROW
  EXECUTE FUNCTION gp_stock_exit_create_charge();

-- 4. Update gestionnaire dashboard KPIs to include stock_gerant source
CREATE OR REPLACE FUNCTION public.get_gestionnaire_dashboard_kpis(
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_result     jsonb;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_build_object(
    'total_revenue',           COALESCE(SUM(r.total_price), 0),
    'trip_count',              COUNT(DISTINCT s.id),
    'active_bus_count',        COUNT(DISTINCT s.bus_id),
    'driver_count',            COUNT(DISTINCT s.driver_id),

    'cc_carburant_complement', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_ration', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_peage', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = v_company_id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Autres depenses comptable hors sorties stock
    'expense_reparation', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_carburant_comptable', COALESCE((
      SELECT SUM(cfw.total_amount)
      FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = v_company_id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Articles depuis le stock (comptable) 
    'expense_autres', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'comptable'
        AND ve.description LIKE 'Sortie stock — %'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Charge stock (gerant principal)
    'expense_charge_stock', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'stock_gerant'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0)
  )
  INTO v_result
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  JOIN reservations r ON r.schedule_id = s.id
  WHERE b.company_id = v_company_id
    AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    AND r.status IN ('confirmee', 'utilisee');

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 5. Update gestionnaire revenue by bus to include charge stock
DROP FUNCTION IF EXISTS public.get_gestionnaire_revenue_by_bus(date, date);

CREATE OR REPLACE FUNCTION public.get_gestionnaire_revenue_by_bus(
  p_date_from date,
  p_date_to   date
)
RETURNS TABLE(
  bus_id                   uuid,
  registration_number      text,
  model                    text,
  trip_count               bigint,
  revenue                  numeric,
  cc_carburant             numeric,
  cc_ration                numeric,
  cc_peage                 numeric,
  fuel_enlev               numeric,
  expense_reparation       numeric,
  expense_autres           numeric,
  expense_charge_stock     numeric,
  vehicle_exp              numeric,
  fuel_carburant_comptable numeric,
  total_expense            numeric,
  margin                   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      b.id AS bus_id,
      b.registration_number,
      b.model,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(r.total_price), 0) AS revenue,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_carburant,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'ration'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_ration,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'peage'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_peage,
      COALESCE((
        SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
        WHERE fe.bus_id = b.id
          AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
      ), 0) AS fuel_enlev,
      -- Autres depenses comptable hors sorties stock
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      -- Articles depuis le stock (comptable)
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND ve.description LIKE 'Sortie stock — %'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_autres,
      -- Charge stock (gerant principal)
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'stock_gerant'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_charge_stock,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'charge_achat'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((
        SELECT SUM(cfw.total_amount)
        FROM comptable_fuel_withdrawals cfw
        WHERE cfw.bus_id = b.id
          AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
      ), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN schedules s ON s.bus_id = b.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = v_company_id
    GROUP BY b.id, b.registration_number, b.model
  )
  SELECT
    base.bus_id,
    base.registration_number,
    base.model,
    base.trip_count,
    base.revenue,
    base.cc_carburant,
    base.cc_ration,
    base.cc_peage,
    base.fuel_enlev,
    base.expense_reparation,
    base.expense_autres,
    base.expense_charge_stock,
    base.vehicle_exp,
    base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage
     + base.fuel_enlev + base.expense_reparation + base.expense_autres
     + base.expense_charge_stock + base.vehicle_exp + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
     - base.fuel_enlev - base.expense_reparation - base.expense_autres
     - base.expense_charge_stock - base.vehicle_exp - base.fuel_carburant_comptable) AS margin
  FROM base;
END;
$$;

-- 6. Update DAF consolidated KPIs to include charge stock
CREATE OR REPLACE FUNCTION public.get_daf_consolidated_kpis(
  p_company_ids uuid[],
  p_date_from   date,
  p_date_to     date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT is_daf_user() THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_build_object(
    'total_revenue',           COALESCE(SUM(r.total_price), 0),
    'trip_count',              COUNT(DISTINCT s.id),
    'active_bus_count',        COUNT(DISTINCT s.bus_id),
    'driver_count',            COUNT(DISTINCT s.driver_id),

    'cc_carburant_complement', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_ration', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_peage', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = ANY(p_company_ids)
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'expense_reparation', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_carburant_comptable', COALESCE((
      SELECT SUM(cfw.total_amount)
      FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = ANY(p_company_ids)
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'expense_autres', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'comptable'
        AND ve.description LIKE 'Sortie stock — %'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'expense_charge_stock', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'stock_gerant'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0)
  )
  INTO v_result
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  JOIN reservations r ON r.schedule_id = s.id
  WHERE b.company_id = ANY(p_company_ids)
    AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    AND r.status IN ('confirmee', 'utilisee');

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- 7. Update DAF revenue by bus to include charge stock
DROP FUNCTION IF EXISTS public.get_daf_revenue_by_bus(uuid[], date, date);

CREATE OR REPLACE FUNCTION public.get_daf_revenue_by_bus(
  p_company_ids uuid[],
  p_date_from   date,
  p_date_to     date
)
RETURNS TABLE(
  bus_id                   uuid,
  registration_number      text,
  model                    text,
  company_name             text,
  trip_count               bigint,
  revenue                  numeric,
  cc_carburant             numeric,
  cc_ration                numeric,
  cc_peage                 numeric,
  fuel_enlev               numeric,
  expense_reparation       numeric,
  expense_autres           numeric,
  expense_charge_stock     numeric,
  vehicle_exp              numeric,
  fuel_carburant_comptable numeric,
  total_expense            numeric,
  margin                   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      b.id AS bus_id,
      b.registration_number,
      b.model,
      c.name AS company_name,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(r.total_price), 0) AS revenue,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_carburant,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'ration'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_ration,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'peage'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_peage,
      COALESCE((
        SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
        WHERE fe.bus_id = b.id
          AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
      ), 0) AS fuel_enlev,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND ve.description LIKE 'Sortie stock — %'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_autres,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'stock_gerant'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_charge_stock,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'charge_achat'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((
        SELECT SUM(cfw.total_amount)
        FROM comptable_fuel_withdrawals cfw
        WHERE cfw.bus_id = b.id
          AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
      ), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN companies c ON c.id = b.company_id
    JOIN schedules s ON s.bus_id = b.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = ANY(p_company_ids)
    GROUP BY b.id, b.registration_number, b.model, c.name
  )
  SELECT
    base.bus_id,
    base.registration_number,
    base.model,
    base.company_name,
    base.trip_count,
    base.revenue,
    base.cc_carburant,
    base.cc_ration,
    base.cc_peage,
    base.fuel_enlev,
    base.expense_reparation,
    base.expense_autres,
    base.expense_charge_stock,
    base.vehicle_exp,
    base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage
     + base.fuel_enlev + base.expense_reparation + base.expense_autres
     + base.expense_charge_stock + base.vehicle_exp + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
     - base.fuel_enlev - base.expense_reparation - base.expense_autres
     - base.expense_charge_stock - base.vehicle_exp - base.fuel_carburant_comptable) AS margin
  FROM base;
END;
$$;

-- 8. RLS: allow gerant_principal to insert via trigger (security definer handles it)
-- No additional RLS needed since the trigger uses SECURITY DEFINER

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
