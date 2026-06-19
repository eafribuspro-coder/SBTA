/*
  # Breakdown revenue split becomes canonical across all RPCs

  When a breakdown is cloturee with an inter-company beneficiary the gross
  revenue of the voyage is split between the original company and the
  beneficiary company. Until now the financial RPCs (gestionnaire dashboard,
  DAF dashboard, per-bus reports, daily series, driver report) read the raw
  reservations/convoys totals and ignored that redistribution.

  This migration introduces a single helper SQL function
  `schedule_company_revenue(date, date)` that returns one row per
  (schedule, attributed company) with the post-split revenue. All financial
  RPCs are rewritten to consume it. The sum of attributed revenues equals
  the gross revenue (no double counting).

  1. New helper
    - `public.schedule_company_revenue(p_from date, p_to date)` returns
      schedule_id, schedule_date, bus_id, driver_id, route_id, station_id,
      company_id, revenue, gross_revenue, transferred_amount, is_beneficiary,
      breakdown_id, breakdown_status, split_reason, replacement_at.

  2. Rewritten Gestionnaire RPCs
    - get_gestionnaire_dashboard_kpis
    - get_gestionnaire_revenue_by_bus (adds breakdown_received, breakdown_transferred)
    - get_gestionnaire_revenue_by_route
    - get_gestionnaire_daily_series
    - get_gestionnaire_driver_report

  3. Rewritten DAF RPCs
    - get_daf_consolidated_kpis
    - get_daf_kpis_by_company (adds breakdown_received, breakdown_transferred)
    - get_daf_revenue_by_bus  (adds breakdown_received, breakdown_transferred)
    - get_daf_daily_series

  4. Invariant
    - gross_revenue = SUM(revenue) over every (schedule, company) row
    - For non-split schedules, exactly one row whose revenue == gross.
*/

-- ───────────────────────────────────────────────────────────────────
-- Helper function
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.schedule_company_revenue(
  p_from date, p_to date
)
RETURNS TABLE (
  schedule_id        uuid,
  schedule_date      date,
  bus_id             uuid,
  driver_id          uuid,
  route_id           uuid,
  station_id         uuid,
  company_id         uuid,
  revenue            numeric,
  gross_revenue      numeric,
  transferred_amount numeric,
  is_beneficiary     boolean,
  breakdown_id       uuid,
  breakdown_status   text,
  split_reason       text,
  replacement_at     timestamptz
)
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
WITH gross AS (
  SELECT
    s.id                          AS sid,
    s.departure_datetime::date    AS sdate,
    s.bus_id                      AS g_bus_id,
    s.driver_id                   AS g_driver_id,
    s.route_id                    AS g_route_id,
    s.departure_station_id        AS g_station_id,
    CASE WHEN s.status = 'convoi'
         THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END                           AS gross_rev
  FROM schedules s
  LEFT JOIN reservations r
    ON r.schedule_id = s.id
   AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv
    ON cv.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_from AND p_to
  GROUP BY s.id, s.departure_datetime, s.bus_id, s.driver_id,
           s.route_id, s.departure_station_id, s.status, cv.amount
),
br AS (
  SELECT DISTINCT ON (sb.schedule_id)
    sb.schedule_id,
    sb.id                                  AS bid,
    sb.status                              AS b_status,
    sb.original_company_id,
    sb.beneficiary_company_id,
    sb.original_bus_id,
    sb.replacement_bus_id,
    sb.original_driver_id,
    sb.replacement_driver_id,
    sb.station_id                          AS b_station_id,
    sb.route_id                            AS b_route_id,
    COALESCE(sb.amount_replacement_company, 0) AS amt_benef,
    COALESCE(sb.amount_original_company, 0)    AS amt_orig,
    sb.split_reason,
    sb.replacement_at
  FROM schedule_breakdowns sb
  ORDER BY sb.schedule_id, sb.breakdown_at DESC
)
-- Origin row: every schedule contributes a row to the original company
SELECT
  g.sid,
  g.sdate,
  COALESCE(br.original_bus_id,    g.g_bus_id)     AS bus_id,
  COALESCE(br.original_driver_id, g.g_driver_id)  AS driver_id,
  COALESCE(br.b_route_id,         g.g_route_id)   AS route_id,
  COALESCE(br.b_station_id,       g.g_station_id) AS station_id,
  COALESCE(br.original_company_id, b.company_id)  AS company_id,
  CASE
    WHEN br.b_status = 'cloture'
     AND br.beneficiary_company_id IS NOT NULL
     AND br.beneficiary_company_id <> br.original_company_id
     AND br.amt_benef > 0
    THEN g.gross_rev - br.amt_benef
    ELSE g.gross_rev
  END                                             AS revenue,
  g.gross_rev                                     AS gross_revenue,
  CASE
    WHEN br.b_status = 'cloture'
     AND br.beneficiary_company_id IS NOT NULL
     AND br.beneficiary_company_id <> br.original_company_id
     AND br.amt_benef > 0
    THEN br.amt_benef
    ELSE 0
  END                                             AS transferred_amount,
  false                                           AS is_beneficiary,
  br.bid                                          AS breakdown_id,
  br.b_status                                     AS breakdown_status,
  br.split_reason                                 AS split_reason,
  br.replacement_at                               AS replacement_at
FROM gross g
JOIN buses b ON b.id = g.g_bus_id
LEFT JOIN br ON br.schedule_id = g.sid

UNION ALL

-- Beneficiary row: only when split is closed and amount > 0
SELECT
  g.sid,
  g.sdate,
  COALESCE(br.replacement_bus_id,    g.g_bus_id)     AS bus_id,
  COALESCE(br.replacement_driver_id, g.g_driver_id)  AS driver_id,
  COALESCE(br.b_route_id,            g.g_route_id)   AS route_id,
  COALESCE(br.b_station_id,          g.g_station_id) AS station_id,
  br.beneficiary_company_id                          AS company_id,
  br.amt_benef                                       AS revenue,
  g.gross_rev                                        AS gross_revenue,
  br.amt_benef                                       AS transferred_amount,
  true                                               AS is_beneficiary,
  br.bid                                             AS breakdown_id,
  br.b_status                                        AS breakdown_status,
  br.split_reason                                    AS split_reason,
  br.replacement_at                                  AS replacement_at
FROM gross g
JOIN br ON br.schedule_id = g.sid
WHERE br.b_status = 'cloture'
  AND br.beneficiary_company_id IS NOT NULL
  AND br.beneficiary_company_id <> br.original_company_id
  AND br.amt_benef > 0;
$fn$;

-- ───────────────────────────────────────────────────────────────────
-- Drop functions whose RETURNS TABLE signature is about to change
-- ───────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_bus(date, date);
DROP FUNCTION IF EXISTS get_daf_kpis_by_company(uuid[], date, date);
DROP FUNCTION IF EXISTS get_daf_revenue_by_bus(uuid[], date, date);

-- ───────────────────────────────────────────────────────────────────
-- 1. get_gestionnaire_dashboard_kpis
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gestionnaire_dashboard_kpis(p_date_from date, p_date_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_result     jsonb;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = v_company_id
  )
  SELECT jsonb_build_object(
    'total_revenue',           COALESCE(SUM(scr.revenue), 0),
    'trip_count',              COUNT(DISTINCT scr.schedule_id),
    'active_bus_count',        COUNT(DISTINCT scr.bus_id),
    'driver_count',            COUNT(DISTINCT scr.driver_id),
    'breakdown_received',      COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0),
    'breakdown_transferred',   COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0),
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
    ), 0)
  )
  INTO v_result
  FROM scr;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 2. get_gestionnaire_revenue_by_bus (signature extended)
-- ───────────────────────────────────────────────────────────────────
CREATE FUNCTION get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric,
  breakdown_received numeric, breakdown_transferred numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = v_company_id
  ),
  agg AS (
    SELECT
      scr.bus_id                          AS bus_id,
      COUNT(DISTINCT scr.schedule_id)::bigint AS trip_count,
      COALESCE(SUM(scr.revenue), 0)       AS revenue,
      COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0)
                                           AS breakdown_received,
      COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0)
                                           AS breakdown_transferred
    FROM scr
    GROUP BY scr.bus_id
  ),
  base AS (
    SELECT
      b.id AS bus_id, b.registration_number, b.model,
      a.trip_count, a.revenue, a.breakdown_received, a.breakdown_transferred,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'carburant_complement'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_carburant,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'ration'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_ration,
      COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc
        WHERE cc.bus_id = b.id AND cc.charge_type = 'peage'
          AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0) AS cc_peage,
      COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
        WHERE fe.bus_id = b.id
          AND fe.enlevement_date BETWEEN p_date_from AND p_date_to), 0) AS fuel_enlev,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND ve.description LIKE 'Sortie stock — %'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_autres,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'charge_achat'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw
        WHERE cfw.bus_id = b.id
          AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN agg a ON a.bus_id = b.id
    WHERE b.company_id = v_company_id
  )
  SELECT base.bus_id, base.registration_number, base.model,
    base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage,
    base.fuel_enlev, base.expense_reparation, base.expense_autres,
    base.vehicle_exp, base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage
     + base.fuel_enlev + base.expense_reparation + base.expense_autres
     + base.vehicle_exp + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
     - base.fuel_enlev - base.expense_reparation - base.expense_autres
     - base.vehicle_exp - base.fuel_carburant_comptable) AS margin,
    base.breakdown_received, base.breakdown_transferred
  FROM base;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 3. get_gestionnaire_revenue_by_route
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_route(p_date_from date, p_date_to date)
RETURNS TABLE(
  route_id uuid, route_name text, trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric,
  total_expense numeric, margin numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = v_company_id
  ),
  chg AS (
    SELECT cc.schedule_id,
      SUM(CASE WHEN cc.charge_type = 'carburant_complement' THEN cc.amount ELSE 0 END) AS carb,
      SUM(CASE WHEN cc.charge_type = 'ration'               THEN cc.amount ELSE 0 END) AS ration,
      SUM(CASE WHEN cc.charge_type = 'peage'                THEN cc.amount ELSE 0 END) AS peage
    FROM counter_charges cc
    WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
      AND EXISTS (SELECT 1 FROM scr WHERE scr.schedule_id = cc.schedule_id AND NOT scr.is_beneficiary)
    GROUP BY cc.schedule_id
  ),
  base AS (
    SELECT
      scr.route_id,
      COUNT(DISTINCT scr.schedule_id)::bigint AS trip_count,
      COALESCE(SUM(scr.revenue), 0)           AS revenue,
      COALESCE(SUM(chg.carb),    0)           AS cc_carburant,
      COALESCE(SUM(chg.ration),  0)           AS cc_ration,
      COALESCE(SUM(chg.peage),   0)           AS cc_peage
    FROM scr
    LEFT JOIN chg ON chg.schedule_id = scr.schedule_id AND NOT scr.is_beneficiary
    GROUP BY scr.route_id
  )
  SELECT
    rt.id AS route_id,
    COALESCE(rt.name, 'Ligne inconnue') AS route_name,
    b.trip_count, b.revenue,
    b.cc_carburant, b.cc_ration, b.cc_peage,
    0::numeric AS fuel_enlev,
    0::numeric AS expense_reparation,
    (b.cc_carburant + b.cc_ration + b.cc_peage) AS total_expense,
    (b.revenue - b.cc_carburant - b.cc_ration - b.cc_peage) AS margin
  FROM base b
  JOIN routes rt ON rt.id = b.route_id
  ORDER BY b.revenue DESC;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 4. get_gestionnaire_daily_series
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gestionnaire_daily_series(p_date_from date, p_date_to date)
RETURNS TABLE(day date, revenue numeric, expenses numeric, trip_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH charges_by_day AS (
    SELECT cc.charge_date AS cday, SUM(cc.amount) AS total_charges
    FROM counter_charges cc
    JOIN buses b2 ON b2.id = cc.bus_id AND b2.company_id = v_company_id
    WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY cc.charge_date
  ),
  scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = v_company_id
  ),
  revenue_by_day AS (
    SELECT scr.schedule_date AS rday,
      COALESCE(SUM(scr.revenue), 0) AS total_revenue,
      COUNT(DISTINCT scr.schedule_id)::bigint AS trip_count
    FROM scr
    GROUP BY scr.schedule_date
  )
  SELECT rd.rday AS day,
    rd.total_revenue AS revenue,
    COALESCE(cd.total_charges, 0) AS expenses,
    rd.trip_count
  FROM revenue_by_day rd
  LEFT JOIN charges_by_day cd ON cd.cday = rd.rday
  ORDER BY rd.rday;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 5. get_gestionnaire_driver_report
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_gestionnaire_driver_report(p_date_from date, p_date_to date)
RETURNS TABLE(
  driver_id uuid, first_name text, last_name text, employee_id text,
  bus_registration text, trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  expense_total numeric, avg_rating numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = v_company_id AND driver_id IS NOT NULL
  ),
  chg AS (
    SELECT scr.driver_id,
      SUM(CASE WHEN cc.charge_type = 'carburant_complement' THEN cc.amount ELSE 0 END) AS carb,
      SUM(CASE WHEN cc.charge_type = 'ration'               THEN cc.amount ELSE 0 END) AS ration,
      SUM(CASE WHEN cc.charge_type = 'peage'                THEN cc.amount ELSE 0 END) AS peage
    FROM counter_charges cc
    JOIN scr ON scr.schedule_id = cc.schedule_id AND NOT scr.is_beneficiary
    WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY scr.driver_id
  ),
  rating_agg AS (
    SELECT dr.driver_id, AVG(dr.rating::numeric) AS avg_r
    FROM driver_reviews dr
    WHERE dr.created_at::date BETWEEN p_date_from AND p_date_to
    GROUP BY dr.driver_id
  ),
  base AS (
    SELECT
      scr.driver_id,
      COUNT(DISTINCT scr.schedule_id)::bigint AS trip_count,
      COALESCE(SUM(scr.revenue), 0)            AS revenue,
      MAX(b.registration_number)               AS bus_reg
    FROM scr
    LEFT JOIN buses b ON b.id = scr.bus_id
    GROUP BY scr.driver_id
  )
  SELECT
    u.id AS driver_id, u.first_name, u.last_name, u.employee_id,
    base.bus_reg AS bus_registration,
    base.trip_count, base.revenue,
    COALESCE(c.carb,   0)::numeric AS cc_carburant,
    COALESCE(c.ration, 0)::numeric AS cc_ration,
    COALESCE(c.peage,  0)::numeric AS cc_peage,
    (COALESCE(c.carb,0) + COALESCE(c.ration,0) + COALESCE(c.peage,0))::numeric AS expense_total,
    rt.avg_r AS avg_rating
  FROM base
  JOIN users u ON u.id = base.driver_id
  LEFT JOIN chg c        ON c.driver_id  = base.driver_id
  LEFT JOIN rating_agg rt ON rt.driver_id = base.driver_id
  ORDER BY base.revenue DESC;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 6. get_daf_consolidated_kpis
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_daf_consolidated_kpis(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT is_daf_user() THEN RETURN '{}'::jsonb; END IF;

  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = ANY(p_company_ids)
  )
  SELECT jsonb_build_object(
    'total_revenue',          COALESCE(SUM(scr.revenue), 0),
    'trip_count',             COUNT(DISTINCT scr.schedule_id),
    'active_bus_count',       COUNT(DISTINCT scr.bus_id),
    'driver_count',           COUNT(DISTINCT scr.driver_id),
    'company_count',          COUNT(DISTINCT scr.company_id),
    'breakdown_received',     COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0),
    'breakdown_transferred',  COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0),
    'cc_carburant_complement', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_ration', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_peage', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = ANY(p_company_ids)
        AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = ANY(p_company_ids)
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'expense_reparation', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'expense_autres', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'comptable'
        AND ve.description LIKE 'Sortie stock — %'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = ANY(p_company_ids)
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'fuel_carburant_comptable', COALESCE((
      SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = ANY(p_company_ids)
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0)
  ) INTO v_result FROM scr;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 7. get_daf_kpis_by_company (signature extended)
-- ───────────────────────────────────────────────────────────────────
CREATE FUNCTION get_daf_kpis_by_company(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(
  company_id uuid, company_name text, company_code text, parent_id uuid, is_group boolean,
  revenue numeric, cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric,
  trip_count bigint, bus_count bigint, driver_count bigint,
  breakdown_received numeric, breakdown_transferred numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = ANY(p_company_ids)
  ),
  agg AS (
    SELECT scr.company_id,
      COALESCE(SUM(scr.revenue), 0)            AS revenue,
      COUNT(DISTINCT scr.schedule_id)::bigint  AS trip_count,
      COUNT(DISTINCT scr.bus_id)::bigint       AS bus_count,
      COUNT(DISTINCT scr.driver_id)
        FILTER (WHERE scr.driver_id IS NOT NULL)::bigint AS driver_count,
      COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0) AS breakdown_received,
      COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0) AS breakdown_transferred
    FROM scr
    GROUP BY scr.company_id
  )
  SELECT
    co.id, co.name, co.code, co.parent_id, COALESCE(co.is_group, false),
    COALESCE(agg.revenue, 0) AS revenue,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_carburant,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_ration,
    COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = co.id AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0) AS cc_peage,
    COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = co.id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_enlev,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS expense_reparation,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'comptable'
        AND ve.description LIKE 'Sortie stock — %'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS expense_autres,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS vehicle_exp,
    COALESCE((
      SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = co.id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_carburant_comptable,
    0::numeric AS total_expense,
    0::numeric AS margin,
    COALESCE(agg.trip_count, 0)::bigint,
    COALESCE(agg.bus_count, 0)::bigint,
    COALESCE(agg.driver_count, 0)::bigint,
    COALESCE(agg.breakdown_received, 0),
    COALESCE(agg.breakdown_transferred, 0)
  FROM companies co
  LEFT JOIN agg ON agg.company_id = co.id
  WHERE co.id = ANY(p_company_ids)
    AND COALESCE(co.is_active, true) = true
  ORDER BY co.name;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 8. get_daf_revenue_by_bus (signature extended)
-- ───────────────────────────────────────────────────────────────────
CREATE FUNCTION get_daf_revenue_by_bus(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  company_id uuid, company_name text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric,
  breakdown_received numeric, breakdown_transferred numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = ANY(p_company_ids)
  ),
  agg AS (
    SELECT scr.bus_id, scr.company_id,
      COUNT(DISTINCT scr.schedule_id)::bigint AS trip_count,
      COALESCE(SUM(scr.revenue), 0)           AS revenue,
      COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0)
                                              AS breakdown_received,
      COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0)
                                              AS breakdown_transferred
    FROM scr
    GROUP BY scr.bus_id, scr.company_id
  ),
  base AS (
    SELECT
      b.id AS bus_id, b.registration_number, b.model,
      a.company_id, co.name AS company_name,
      a.trip_count, a.revenue, a.breakdown_received, a.breakdown_transferred,
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
          AND ve.source = 'charge_achat'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw WHERE cfw.bus_id = b.id AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN agg a ON a.bus_id = b.id
    JOIN companies co ON co.id = a.company_id
  )
  SELECT base.bus_id, base.registration_number, base.model,
    base.company_id, base.company_name, base.trip_count, base.revenue,
    base.cc_carburant, base.cc_ration, base.cc_peage, base.fuel_enlev,
    base.expense_reparation, base.expense_autres, base.vehicle_exp, base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage + base.fuel_enlev
     + base.expense_reparation + base.expense_autres + base.vehicle_exp
     + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage - base.fuel_enlev
     - base.expense_reparation - base.expense_autres - base.vehicle_exp
     - base.fuel_carburant_comptable) AS margin,
    base.breakdown_received, base.breakdown_transferred
  FROM base
  ORDER BY base.revenue DESC;
END;
$$;

-- ───────────────────────────────────────────────────────────────────
-- 9. get_daf_daily_series
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_daf_daily_series(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(day date, revenue numeric, expenses numeric, trip_count bigint)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_date_from, p_date_to, '1 day'::interval)::date AS d
  ),
  scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
    WHERE company_id = ANY(p_company_ids)
  ),
  rev AS (
    SELECT scr.schedule_date AS d,
      SUM(scr.revenue) AS rev,
      COUNT(DISTINCT scr.schedule_id)::bigint AS cnt
    FROM scr GROUP BY scr.schedule_date
  ),
  exp AS (
    SELECT cc.charge_date AS d, SUM(cc.amount) AS exp
    FROM counter_charges cc
    JOIN buses b ON b.id = cc.bus_id
    WHERE b.company_id = ANY(p_company_ids)
      AND cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  )
  SELECT
    days.d AS day,
    COALESCE(rev.rev, 0) AS revenue,
    COALESCE(exp.exp, 0) AS expenses,
    COALESCE(rev.cnt, 0) AS trip_count
  FROM days
  LEFT JOIN rev ON rev.d = days.d
  LEFT JOIN exp ON exp.d = days.d
  WHERE COALESCE(rev.rev, 0) > 0 OR COALESCE(exp.exp, 0) > 0
  ORDER BY days.d;
END;
$$;

NOTIFY pgrst, 'reload schema';
