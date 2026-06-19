/*
  # DAF Consolidated RPC Functions

  ## Overview
  Creates RPC functions for the DAF (Directeur Administratif et Financier) dashboard.
  The DAF can view consolidated data across ALL companies, unlike Gestionnaire who
  is limited to their own company.

  ## New Functions
  1. get_daf_company_list() — Returns all active companies with hierarchy
  2. get_daf_consolidated_kpis(company_ids, date_from, date_to) — Aggregated KPIs across specified companies
  3. get_daf_kpis_by_company(company_ids, date_from, date_to) — Per-company KPI breakdown
  4. get_daf_revenue_by_bus(company_ids, date_from, date_to) — Per-bus breakdown across companies
  5. get_daf_daily_series(company_ids, date_from, date_to) — Daily time-series for charts

  ## Security
  - All functions use SECURITY DEFINER with search_path fixed to 'public'
  - Access restricted to users with role='daf' in app_metadata
*/

-- ============================================================
-- Helper: check if caller is DAF
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_daf_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'daf',
    false
  );
$$;

-- ============================================================
-- 1. get_daf_company_list
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daf_company_list()
RETURNS TABLE(
  id          uuid,
  name        text,
  code        text,
  parent_id   uuid,
  is_group    boolean,
  is_active   boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.id, c.name, c.code, c.parent_id, COALESCE(c.is_group, false), COALESCE(c.is_active, true)
    FROM companies c
    WHERE COALESCE(c.is_active, true) = true
    ORDER BY c.name;
END;
$$;

-- ============================================================
-- 2. get_daf_consolidated_kpis — global aggregation
-- ============================================================
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
    'total_revenue', COALESCE((
      SELECT SUM(r.total_price)
      FROM reservations r
      JOIN schedules s ON s.id = r.schedule_id
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND r.status IN ('confirmee', 'utilisee')
    ), 0),

    'trip_count', COALESCE((
      SELECT COUNT(DISTINCT s.id)
      FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'active_bus_count', COALESCE((
      SELECT COUNT(DISTINCT s.bus_id)
      FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'driver_count', COALESCE((
      SELECT COUNT(DISTINCT s.driver_id)
      FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND s.driver_id IS NOT NULL
    ), 0),

    'company_count', COALESCE((
      SELECT COUNT(DISTINCT b.company_id)
      FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    ), 0),

    'cc_carburant_complement', COALESCE((
      SELECT SUM(cc.amount)
      FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'cc_ration', COALESCE((
      SELECT SUM(cc.amount)
      FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'cc_peage', COALESCE((
      SELECT SUM(cc.amount)
      FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount)
      FROM fuel_enlevements fe
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
    ), 0)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ============================================================
-- 3. get_daf_kpis_by_company — per-company breakdown
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daf_kpis_by_company(
  p_company_ids uuid[],
  p_date_from   date,
  p_date_to     date
)
RETURNS TABLE(
  company_id               uuid,
  company_name             text,
  company_code             text,
  parent_id                uuid,
  is_group                 boolean,
  revenue                  numeric,
  cc_carburant             numeric,
  cc_ration                numeric,
  cc_peage                 numeric,
  fuel_enlev               numeric,
  expense_reparation       numeric,
  expense_autres           numeric,
  vehicle_exp              numeric,
  fuel_carburant_comptable numeric,
  total_expense            numeric,
  margin                   numeric,
  trip_count               bigint,
  bus_count                bigint,
  driver_count             bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    co.id AS company_id,
    co.name AS company_name,
    co.code AS company_code,
    co.parent_id,
    COALESCE(co.is_group, false) AS is_group,
    COALESCE((
      SELECT SUM(r.total_price)
      FROM reservations r
      JOIN schedules s ON s.id = r.schedule_id
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = co.id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND r.status IN ('confirmee', 'utilisee')
    ), 0) AS revenue,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id
        AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_carburant,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id
        AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_ration,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id
        AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_peage,
    COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = co.id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_enlev,
    COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
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
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
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
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS vehicle_exp,
    COALESCE((
      SELECT SUM(cfw.total_amount)
      FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = co.id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_carburant_comptable,
    -- total_expense placeholder (computed below)
    0::numeric AS total_expense,
    0::numeric AS margin,
    COALESCE((
      SELECT COUNT(DISTINCT s.id)
      FROM schedules s JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = co.id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    ), 0)::bigint AS trip_count,
    COALESCE((
      SELECT COUNT(DISTINCT s.bus_id)
      FROM schedules s JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = co.id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    ), 0)::bigint AS bus_count,
    COALESCE((
      SELECT COUNT(DISTINCT s.driver_id)
      FROM schedules s JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = co.id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND s.driver_id IS NOT NULL
    ), 0)::bigint AS driver_count
  FROM companies co
  WHERE co.id = ANY(p_company_ids)
    AND COALESCE(co.is_active, true) = true
  ORDER BY co.name;
END;
$$;

-- ============================================================
-- 4. get_daf_revenue_by_bus — all buses across companies
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daf_revenue_by_bus(
  p_company_ids uuid[],
  p_date_from   date,
  p_date_to     date
)
RETURNS TABLE(
  bus_id                   uuid,
  registration_number      text,
  model                    text,
  company_id               uuid,
  company_name             text,
  trip_count               bigint,
  revenue                  numeric,
  cc_carburant             numeric,
  cc_ration                numeric,
  cc_peage                 numeric,
  fuel_enlev               numeric,
  expense_reparation       numeric,
  expense_autres           numeric,
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
      b.company_id,
      co.name AS company_name,
      COUNT(DISTINCT s.id)::bigint AS trip_count,
      COALESCE(SUM(r.total_price), 0) AS revenue,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = b.id AND cc.charge_type = 'ration' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = b.id AND cc.charge_type = 'peage' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,
      COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe WHERE fe.bus_id = b.id AND fe.enlevement_date BETWEEN p_date_from AND p_date_to), 0) AS fuel_enlev,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable' AND ve.description LIKE 'Sortie stock — %'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_autres,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'charge_achat' AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw WHERE cfw.bus_id = b.id AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN companies co ON co.id = b.company_id
    JOIN schedules s ON s.bus_id = b.id AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = ANY(p_company_ids)
    GROUP BY b.id, b.registration_number, b.model, b.company_id, co.name
  )
  SELECT
    base.bus_id, base.registration_number, base.model,
    base.company_id, base.company_name, base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage, base.fuel_enlev,
    base.expense_reparation, base.expense_autres, base.vehicle_exp, base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage + base.fuel_enlev
     + base.expense_reparation + base.expense_autres + base.vehicle_exp
     + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage - base.fuel_enlev
     - base.expense_reparation - base.expense_autres - base.vehicle_exp
     - base.fuel_carburant_comptable) AS margin
  FROM base
  ORDER BY base.revenue DESC;
END;
$$;

-- ============================================================
-- 5. get_daf_daily_series — time-series for charts
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daf_daily_series(
  p_company_ids uuid[],
  p_date_from   date,
  p_date_to     date
)
RETURNS TABLE(
  day        date,
  revenue    numeric,
  expenses   numeric,
  trip_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_date_from, p_date_to, '1 day'::interval)::date AS d
  ),
  rev AS (
    SELECT s.departure_datetime::date AS d, SUM(r.total_price) AS rev
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id
    LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = ANY(p_company_ids)
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  ),
  exp AS (
    SELECT cc.charge_date AS d, SUM(cc.amount) AS exp
    FROM counter_charges cc
    JOIN buses b ON b.id = cc.bus_id
    WHERE b.company_id = ANY(p_company_ids)
      AND cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  ),
  trips AS (
    SELECT s.departure_datetime::date AS d, COUNT(DISTINCT s.id)::bigint AS cnt
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id
    WHERE b.company_id = ANY(p_company_ids)
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  )
  SELECT
    days.d AS day,
    COALESCE(rev.rev, 0) AS revenue,
    COALESCE(exp.exp, 0) AS expenses,
    COALESCE(trips.cnt, 0) AS trip_count
  FROM days
  LEFT JOIN rev   ON rev.d   = days.d
  LEFT JOIN exp   ON exp.d   = days.d
  LEFT JOIN trips ON trips.d = days.d
  WHERE COALESCE(rev.rev, 0) > 0 OR COALESCE(exp.exp, 0) > 0
  ORDER BY days.d;
END;
$$;

-- Rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
