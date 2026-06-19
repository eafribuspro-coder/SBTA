/*
  # Gestionnaire RPC Functions — Correct counter_charges sourcing

  ## Summary
  Drops and recreates all 5 gestionnaire RPC functions so that:
  - Carburant complement, Rations, Péages come from `counter_charges` table
    (guichetier departure charges), NOT from bus_expenses
  - Company isolation via get_gestionnaire_company_id() helper
  - All functions use SECURITY DEFINER with search_path = public

  ## Functions
  1. get_gestionnaire_dashboard_kpis — global KPIs for dashboard
  2. get_gestionnaire_revenue_by_bus — per-bus breakdown
  3. get_gestionnaire_revenue_by_route — per-route breakdown
  4. get_gestionnaire_daily_series — daily revenue/expense time series
  5. get_gestionnaire_driver_report — per-driver report
*/

-- Drop existing functions to allow changing return types
DROP FUNCTION IF EXISTS get_gestionnaire_dashboard_kpis(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_bus(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_route(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_daily_series(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_driver_report(date, date);

-- Helper: get company_id of the calling gestionnaire
CREATE OR REPLACE FUNCTION get_gestionnaire_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

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
    'total_revenue',            COALESCE(SUM(r.total_amount), 0),
    'trip_count',               COUNT(DISTINCT s.id),
    'active_bus_count',         COUNT(DISTINCT s.bus_id),
    'driver_count',             COUNT(DISTINCT s.driver_id),

    -- Guichetier charges (counter_charges)
    'cc_carburant_complement',  COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'carburant_complement'
        AND cc.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_ration',                COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'ration'
        AND cc.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_peage',                 COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.charge_type = 'peage'
        AND cc.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Fuel from tank (enlevements)
    'fuel_enlevements_amount',  COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = v_company_id
        AND fe.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Bus repairs (bus_expenses)
    'expense_reparation',       COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b3 ON b3.id = be.bus_id
      WHERE b3.company_id = v_company_id
        AND be.expense_type IN ('reparation', 'maintenance')
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Other bus expenses
    'expense_autres',           COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b3 ON b3.id = be.bus_id
      WHERE b3.company_id = v_company_id
        AND be.expense_type NOT IN ('reparation', 'maintenance', 'carburant')
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Vehicle/purchase expenses (charge_achat)
    'vehicle_expenses_amount',  COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      WHERE ve.company_id = v_company_id
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0)
  )
  INTO v_result
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  JOIN reservations r ON r.schedule_id = s.id
  WHERE b.company_id = v_company_id
    AND s.departure_time::date BETWEEN p_date_from AND p_date_to
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
  SELECT
    b.id AS bus_id,
    b.registration_number,
    b.model,
    COUNT(DISTINCT s.id)::bigint AS trip_count,
    COALESCE(SUM(res.total_amount), 0) AS revenue,

    -- Guichetier charges from counter_charges
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
              WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement'
                AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
              WHERE cc.bus_id = b.id AND cc.charge_type = 'ration'
                AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
              WHERE cc.bus_id = b.id AND cc.charge_type = 'peage'
                AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,

    -- Fuel enlevements
    COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
              WHERE fe.bus_id = b.id
                AND fe.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS fuel_enlev,

    -- Repairs
    COALESCE((SELECT SUM(be.amount) FROM bus_expenses be
              WHERE be.bus_id = b.id AND be.expense_type IN ('reparation', 'maintenance')
                AND be.expense_date BETWEEN p_date_from AND p_date_to), 0) AS expense_reparation,

    -- Vehicle expenses
    COALESCE((SELECT SUM(ve.amount) FROM vehicle_expenses ve
              WHERE ve.bus_id = b.id
                AND ve.expense_date BETWEEN p_date_from AND p_date_to), 0) AS vehicle_exp,

    -- Totals computed below
    0::numeric AS total_expense,
    0::numeric AS margin
  FROM buses b
  JOIN schedules s ON s.bus_id = b.id
    AND s.departure_time::date BETWEEN p_date_from AND p_date_to
  LEFT JOIN reservations res ON res.schedule_id = s.id
    AND res.status IN ('confirmee', 'utilisee')
  WHERE b.company_id = v_company_id
  GROUP BY b.id, b.registration_number, b.model;
END;
$$;

-- Wrapper view to compute total_expense and margin properly
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_bus(date, date);

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
      COALESCE(SUM(res.total_amount), 0) AS revenue,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = b.id AND cc.charge_type = 'ration'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = b.id AND cc.charge_type = 'peage'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,
      COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
                WHERE fe.bus_id = b.id
                  AND fe.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS fuel_enlev,
      COALESCE((SELECT SUM(be.amount) FROM bus_expenses be
                WHERE be.bus_id = b.id AND be.expense_type IN ('reparation', 'maintenance')
                  AND be.expense_date BETWEEN p_date_from AND p_date_to), 0) AS expense_reparation,
      COALESCE((SELECT SUM(ve.amount) FROM vehicle_expenses ve
                WHERE ve.bus_id = b.id
                  AND ve.expense_date BETWEEN p_date_from AND p_date_to), 0) AS vehicle_exp
    FROM buses b
    JOIN schedules s ON s.bus_id = b.id
      AND s.departure_time::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations res ON res.schedule_id = s.id
      AND res.status IN ('confirmee', 'utilisee')
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
      COALESCE(rt.name, rt.origin || ' → ' || rt.destination) AS route_name,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(res.total_amount), 0) AS revenue,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                JOIN schedules s2 ON s2.bus_id = cc.bus_id
                WHERE s2.route_id = rt.id AND cc.charge_type = 'carburant_complement'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                JOIN schedules s2 ON s2.bus_id = cc.bus_id
                WHERE s2.route_id = rt.id AND cc.charge_type = 'ration'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                JOIN schedules s2 ON s2.bus_id = cc.bus_id
                WHERE s2.route_id = rt.id AND cc.charge_type = 'peage'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,
      COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
                JOIN schedules s2 ON s2.bus_id = fe.bus_id
                WHERE s2.route_id = rt.id
                  AND fe.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS fuel_enlev,
      COALESCE((SELECT SUM(be.amount) FROM bus_expenses be
                JOIN schedules s2 ON s2.bus_id = be.bus_id
                WHERE s2.route_id = rt.id AND be.expense_type IN ('reparation', 'maintenance')
                  AND be.expense_date BETWEEN p_date_from AND p_date_to), 0) AS expense_reparation
    FROM routes rt
    JOIN schedules s ON s.route_id = rt.id
      AND s.departure_time::date BETWEEN p_date_from AND p_date_to
    JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
    LEFT JOIN reservations res ON res.schedule_id = s.id
      AND res.status IN ('confirmee', 'utilisee')
    GROUP BY rt.id, rt.name, rt.origin, rt.destination
  )
  SELECT
    base.route_id, base.route_name,
    base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage,
    base.fuel_enlev, base.expense_reparation,
    (base.cc_carburant + base.cc_ration + base.cc_peage + base.fuel_enlev + base.expense_reparation) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage - base.fuel_enlev - base.expense_reparation) AS margin
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
    s.departure_time::date AS day,
    COALESCE(SUM(res.total_amount), 0) AS revenue,
    COALESCE((
      SELECT SUM(cc.amount)
      FROM counter_charges cc
      JOIN buses b2 ON b2.id = cc.bus_id
      WHERE b2.company_id = v_company_id
        AND cc.created_at::date = s.departure_time::date
    ), 0) AS expenses,
    COUNT(DISTINCT s.id)::bigint AS trip_count
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
  LEFT JOIN reservations res ON res.schedule_id = s.id
    AND res.status IN ('confirmee', 'utilisee')
  WHERE s.departure_time::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.departure_time::date
  ORDER BY s.departure_time::date;
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
      u.first_name, u.last_name, u.employee_id,
      MAX(b.registration_number) AS bus_registration,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(res.total_amount), 0) AS revenue,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = s.bus_id AND cc.charge_type = 'carburant_complement'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = s.bus_id AND cc.charge_type = 'ration'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
                WHERE cc.bus_id = s.bus_id AND cc.charge_type = 'peage'
                  AND cc.created_at::date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,
      COALESCE(AVG(dr.rating), 0) AS avg_rating
    FROM users u
    JOIN schedules s ON s.driver_id = u.id
      AND s.departure_time::date BETWEEN p_date_from AND p_date_to
    JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
    LEFT JOIN reservations res ON res.schedule_id = s.id
      AND res.status IN ('confirmee', 'utilisee')
    LEFT JOIN driver_reviews dr ON dr.driver_id = u.id
      AND dr.created_at::date BETWEEN p_date_from AND p_date_to
    WHERE u.role = 'chauffeur'
    GROUP BY u.id, u.first_name, u.last_name, u.employee_id, s.bus_id
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
