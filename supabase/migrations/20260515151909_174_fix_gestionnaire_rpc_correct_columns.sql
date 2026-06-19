/*
  # Fix Gestionnaire RPC Functions — Correct Column Names

  ## Problem
  Migration 173 used several wrong column/table references that caused zero results:
  - `reservations.total_amount` → correct: `total_price`
  - `schedules.departure_time` → correct: `departure_datetime`
  - `routes.origin || routes.destination` → correct: `routes.name`
  - `vehicle_expenses.bus_id` (doesn't exist) → correct: join via `fleet_vehicles.company_id`
  - `fuel_enlevements` date filter used `created_at` → correct: `enlevement_date`
  - `counter_charges` date filter used `created_at` → correct: `charge_date`

  ## Changes
  Drops and recreates all 5 gestionnaire RPC functions with correct column references.
*/

DROP FUNCTION IF EXISTS get_gestionnaire_dashboard_kpis(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_bus(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_route(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_daily_series(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_driver_report(date, date);

-- 1. Dashboard KPIs
CREATE OR REPLACE FUNCTION get_gestionnaire_dashboard_kpis(p_date_from date, p_date_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_build_object(
    'total_revenue',           COALESCE(SUM(r.total_price), 0),
    'trip_count',              COUNT(DISTINCT s.id),
    'active_bus_count',        COUNT(DISTINCT s.bus_id),
    'driver_count',            COUNT(DISTINCT s.driver_id),

    -- Guichetier charges from counter_charges (filtered by charge_date)
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

    -- Fuel from tank (enlevements) — use enlevement_date
    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = v_company_id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Bus maintenance/repairs (bus_expenses, all types)
    'expense_reparation', COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b3 ON b3.id = be.bus_id
      WHERE b3.company_id = v_company_id
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Vehicle/purchase expenses (charge_achat) — via fleet_vehicles.company_id
    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
      WHERE fv.company_id = v_company_id
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'expense_autres', 0
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

-- 2. Revenue by bus
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, vehicle_exp numeric,
  total_expense numeric, margin numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      COALESCE((
        SELECT SUM(be.amount) FROM bus_expenses be
        WHERE be.bus_id = b.id
          AND be.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
        WHERE fv.registration_number = b.registration_number
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp
    FROM buses b
    JOIN schedules s ON s.bus_id = b.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = v_company_id
    GROUP BY b.id, b.registration_number, b.model
  )
  SELECT
    base.bus_id, base.registration_number, base.model,
    base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage,
    base.fuel_enlev, base.expense_reparation, base.vehicle_exp,
    (base.cc_carburant + base.cc_ration + base.cc_peage + base.fuel_enlev + base.expense_reparation + base.vehicle_exp) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage - base.fuel_enlev - base.expense_reparation - base.vehicle_exp) AS margin
  FROM base;
END;
$$;

-- 3. Revenue by route
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_route(p_date_from date, p_date_to date)
RETURNS TABLE(
  route_id uuid, route_name text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric,
  total_expense numeric, margin numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      rt.id AS route_id,
      COALESCE(rt.name, 'Ligne inconnue') AS route_name,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(r.total_price), 0) AS revenue,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.schedule_id = s.id AND cc.charge_type = 'carburant_complement'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_carburant,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.schedule_id = s.id AND cc.charge_type = 'ration'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_ration,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.schedule_id = s.id AND cc.charge_type = 'peage'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_peage,
      0::numeric AS fuel_enlev,
      0::numeric AS expense_reparation
    FROM routes rt
    JOIN schedules s ON s.route_id = rt.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    GROUP BY rt.id, rt.name
  )
  SELECT
    base.route_id, base.route_name,
    base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage,
    base.fuel_enlev, base.expense_reparation,
    (base.cc_carburant + base.cc_ration + base.cc_peage) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage) AS margin
  FROM base;
END;
$$;

-- 4. Daily series
CREATE OR REPLACE FUNCTION get_gestionnaire_daily_series(p_date_from date, p_date_to date)
RETURNS TABLE(day date, revenue numeric, expenses numeric, trip_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.departure_datetime::date AS day,
    COALESCE(SUM(r.total_price), 0) AS revenue,
    COALESCE((
      SELECT SUM(cc.amount)
      FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_date = s.departure_datetime::date
    ), 0) AS expenses,
    COUNT(DISTINCT s.id)::bigint AS trip_count
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
  LEFT JOIN reservations r ON r.schedule_id = s.id
    AND r.status IN ('confirmee', 'utilisee')
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.departure_datetime::date
  ORDER BY s.departure_datetime::date;
END;
$$;

-- 5. Driver report
CREATE OR REPLACE FUNCTION get_gestionnaire_driver_report(p_date_from date, p_date_to date)
RETURNS TABLE(
  driver_id uuid, first_name text, last_name text,
  employee_id text, bus_registration text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  expense_total numeric, avg_rating numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH driver_base AS (
    SELECT
      u.id AS driver_id,
      u.first_name,
      u.last_name,
      u.employee_id,
      MAX(b.registration_number) AS bus_registration,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(r.total_price), 0) AS revenue,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        JOIN schedules s2 ON s2.id = cc.schedule_id
        WHERE s2.driver_id = u.id AND cc.charge_type = 'carburant_complement'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_carburant,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        JOIN schedules s2 ON s2.id = cc.schedule_id
        WHERE s2.driver_id = u.id AND cc.charge_type = 'ration'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_ration,
      COALESCE((
        SELECT SUM(cc.amount) FROM counter_charges cc
        JOIN schedules s2 ON s2.id = cc.schedule_id
        WHERE s2.driver_id = u.id AND cc.charge_type = 'peage'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to
      ), 0) AS cc_peage,
      COALESCE(AVG(dr.rating::numeric), 0) AS avg_rating
    FROM users u
    JOIN schedules s ON s.driver_id = u.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    LEFT JOIN driver_reviews dr ON dr.driver_id = u.id
      AND dr.created_at::date BETWEEN p_date_from AND p_date_to
    WHERE u.role = 'chauffeur'
    GROUP BY u.id, u.first_name, u.last_name, u.employee_id
  )
  SELECT
    db.driver_id, db.first_name, db.last_name, db.employee_id, db.bus_registration,
    db.trip_count, db.revenue,
    db.cc_carburant, db.cc_ration, db.cc_peage,
    (db.cc_carburant + db.cc_ration + db.cc_peage) AS expense_total,
    db.avg_rating
  FROM driver_base db;
END;
$$;
