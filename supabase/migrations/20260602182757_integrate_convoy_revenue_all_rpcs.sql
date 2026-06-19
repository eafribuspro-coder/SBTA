/*
  # Integrate convoy revenue into all financial RPC functions

  All Gestionnaire and DAF financial RPC functions currently compute revenue
  only from the reservations table, missing convoy departures entirely.
  
  This migration updates all 9 affected functions to include convoy amounts
  in revenue calculations by LEFT JOINing the convoys table.

  1. Modified Functions (Gestionnaire)
    - `get_gestionnaire_dashboard_kpis` — adds convoy amounts to total_revenue
    - `get_gestionnaire_revenue_by_bus` — adds convoy amounts to per-bus revenue
    - `get_gestionnaire_revenue_by_route` — adds convoy amounts to per-route revenue
    - `get_gestionnaire_daily_series` — adds convoy amounts to daily revenue series
    - `get_gestionnaire_driver_report` — adds convoy amounts to per-driver revenue

  2. Modified Functions (DAF)
    - `get_daf_consolidated_kpis` — adds convoy amounts to consolidated revenue
    - `get_daf_kpis_by_company` — adds convoy amounts to per-company revenue
    - `get_daf_revenue_by_bus` — adds convoy amounts to per-bus revenue
    - `get_daf_daily_series` — adds convoy amounts to daily revenue series

  3. Logic
    - For convoy schedules (status = 'convoi'), revenue = convoy amount (not reservation sum)
    - For normal schedules, revenue = reservation sum (unchanged)
    - Uses CASE WHEN s.status = 'convoi' THEN cv.amount ELSE SUM(r.total_price) END
*/

-- ═══════════════════════════════════════════════════════════════════
-- 1. get_gestionnaire_dashboard_kpis
-- ═══════════════════════════════════════════════════════════════════
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

WITH schedule_revenue AS (
  SELECT s.id AS sid, s.bus_id, s.driver_id,
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END AS revenue
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
  LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.id, s.status, cv.amount
)
SELECT jsonb_build_object(
'total_revenue',           COALESCE(SUM(sr.revenue), 0),
'trip_count',              COUNT(DISTINCT sr.sid),
'active_bus_count',        COUNT(DISTINCT sr.bus_id),
'driver_count',            COUNT(DISTINCT sr.driver_id),

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
FROM schedule_revenue sr;

RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 2. get_gestionnaire_revenue_by_bus
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
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
WITH sched_rev AS (
  SELECT s.id AS sid, s.bus_id AS s_bus_id,
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END AS srev
  FROM schedules s
  LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.id, s.bus_id, s.status, cv.amount
),
base AS (
SELECT
b.id AS bus_id,
b.registration_number,
b.model,
COUNT(DISTINCT sr.sid)::bigint AS trip_count,
COALESCE(SUM(sr.srev), 0) AS revenue,
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
JOIN sched_rev sr ON sr.s_bus_id = b.id
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
base.vehicle_exp,
base.fuel_carburant_comptable,
(base.cc_carburant + base.cc_ration + base.cc_peage
+ base.fuel_enlev + base.expense_reparation + base.expense_autres
+ base.vehicle_exp + base.fuel_carburant_comptable) AS total_expense,
(base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
- base.fuel_enlev - base.expense_reparation - base.expense_autres
- base.vehicle_exp - base.fuel_carburant_comptable) AS margin
FROM base;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 3. get_gestionnaire_revenue_by_route
-- ═══════════════════════════════════════════════════════════════════
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
WITH sched AS (
SELECT s.id AS sid, s.route_id, b.id AS bid
FROM schedules s
JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
),
rev AS (
SELECT sc.sid AS schedule_id,
  CASE WHEN sch.status = 'convoi' THEN COALESCE(cv.amount, 0)
       ELSE COALESCE(SUM(r.total_price), 0)
  END AS total
FROM sched sc
JOIN schedules sch ON sch.id = sc.sid
LEFT JOIN reservations r ON r.schedule_id = sc.sid AND r.status IN ('confirmee', 'utilisee')
LEFT JOIN convoys cv ON cv.schedule_id = sc.sid
GROUP BY sc.sid, sch.status, cv.amount
),
chg AS (
SELECT cc.schedule_id,
SUM(CASE WHEN cc.charge_type = 'carburant_complement' THEN cc.amount ELSE 0 END) AS carb,
SUM(CASE WHEN cc.charge_type = 'ration'               THEN cc.amount ELSE 0 END) AS ration,
SUM(CASE WHEN cc.charge_type = 'peage'                THEN cc.amount ELSE 0 END) AS peage
FROM counter_charges cc
JOIN sched ON sched.sid = cc.schedule_id
WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
GROUP BY cc.schedule_id
),
base AS (
SELECT
s.route_id,
COUNT(DISTINCT s.sid)::bigint AS trip_count,
COALESCE(SUM(rev.total), 0) AS revenue,
COALESCE(SUM(chg.carb),   0) AS cc_carburant,
COALESCE(SUM(chg.ration), 0) AS cc_ration,
COALESCE(SUM(chg.peage),  0) AS cc_peage
FROM sched s
LEFT JOIN rev ON rev.schedule_id = s.sid
LEFT JOIN chg ON chg.schedule_id = s.sid
GROUP BY s.route_id
)
SELECT
rt.id AS route_id,
COALESCE(rt.name, 'Ligne inconnue') AS route_name,
b.trip_count,
b.revenue,
b.cc_carburant,
b.cc_ration,
b.cc_peage,
0::numeric AS fuel_enlev,
0::numeric AS expense_reparation,
(b.cc_carburant + b.cc_ration + b.cc_peage) AS total_expense,
(b.revenue - b.cc_carburant - b.cc_ration - b.cc_peage) AS margin
FROM base b
JOIN routes rt ON rt.id = b.route_id
ORDER BY b.revenue DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. get_gestionnaire_daily_series
-- ═══════════════════════════════════════════════════════════════════
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
sched_rev AS (
  SELECT s.id AS sid, s.departure_datetime::date AS rday,
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END AS srev
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
  LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.id, s.departure_datetime::date, s.status, cv.amount
),
revenue_by_day AS (
SELECT
sr.rday,
COALESCE(SUM(sr.srev), 0) AS total_revenue,
COUNT(DISTINCT sr.sid)::bigint AS trip_count
FROM sched_rev sr
GROUP BY sr.rday
)
SELECT
rd.rday AS day,
rd.total_revenue AS revenue,
COALESCE(cd.total_charges, 0) AS expenses,
rd.trip_count
FROM revenue_by_day rd
LEFT JOIN charges_by_day cd ON cd.cday = rd.rday
ORDER BY rd.rday;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. get_gestionnaire_driver_report
-- ═══════════════════════════════════════════════════════════════════
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
WITH sched_co AS (
SELECT s.id AS sid, s.driver_id, b.registration_number
FROM schedules s
JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
AND s.driver_id IS NOT NULL
),
rev_agg AS (
SELECT sc.sid AS schedule_id,
  CASE WHEN sch.status = 'convoi' THEN COALESCE(cv.amount, 0)
       ELSE COALESCE(SUM(r.total_price), 0)
  END AS total
FROM sched_co sc
JOIN schedules sch ON sch.id = sc.sid
LEFT JOIN reservations r ON r.schedule_id = sc.sid AND r.status IN ('confirmee', 'utilisee')
LEFT JOIN convoys cv ON cv.schedule_id = sc.sid
GROUP BY sc.sid, sch.status, cv.amount
),
chg_agg AS (
SELECT
sc.driver_id,
SUM(CASE WHEN cc.charge_type = 'carburant_complement' THEN cc.amount ELSE 0 END) AS carb,
SUM(CASE WHEN cc.charge_type = 'ration'               THEN cc.amount ELSE 0 END) AS ration,
SUM(CASE WHEN cc.charge_type = 'peage'                THEN cc.amount ELSE 0 END) AS peage
FROM counter_charges cc
JOIN sched_co sc ON sc.sid = cc.schedule_id
WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
GROUP BY sc.driver_id
),
rating_agg AS (
SELECT dr.driver_id, AVG(dr.rating::numeric) AS avg_r
FROM driver_reviews dr
WHERE dr.created_at::date BETWEEN p_date_from AND p_date_to
GROUP BY dr.driver_id
),
base AS (
SELECT
sc.driver_id,
COUNT(DISTINCT sc.sid)::bigint           AS trip_count,
COALESCE(SUM(ra.total), 0)               AS revenue,
MAX(sc.registration_number)              AS bus_reg
FROM sched_co sc
LEFT JOIN rev_agg ra ON ra.schedule_id = sc.sid
GROUP BY sc.driver_id
)
SELECT
u.id                                   AS driver_id,
u.first_name,
u.last_name,
u.employee_id,
b.bus_reg                              AS bus_registration,
b.trip_count,
b.revenue,
COALESCE(c.carb,   0)                  AS cc_carburant,
COALESCE(c.ration, 0)                  AS cc_ration,
COALESCE(c.peage,  0)                  AS cc_peage,
COALESCE(c.carb,0) + COALESCE(c.ration,0) + COALESCE(c.peage,0) AS expense_total,
rt.avg_r                               AS avg_rating
FROM base b
JOIN users u ON u.id = b.driver_id
LEFT JOIN chg_agg    c  ON c.driver_id  = b.driver_id
LEFT JOIN rating_agg rt ON rt.driver_id = b.driver_id
ORDER BY b.revenue DESC;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. get_daf_consolidated_kpis
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_daf_consolidated_kpis(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_result jsonb;
BEGIN
IF NOT is_daf_user() THEN RETURN '{}'::jsonb; END IF;

SELECT jsonb_build_object(
'total_revenue', COALESCE((
  SELECT SUM(
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(r_agg.rev, 0)
    END
  )
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  LEFT JOIN (
    SELECT r.schedule_id, SUM(r.total_price) AS rev
    FROM reservations r WHERE r.status IN ('confirmee','utilisee')
    GROUP BY r.schedule_id
  ) r_agg ON r_agg.schedule_id = s.id
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE b.company_id = ANY(p_company_ids)
  AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
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


-- ═══════════════════════════════════════════════════════════════════
-- 7. get_daf_kpis_by_company
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_daf_kpis_by_company(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(
  company_id uuid, company_name text, company_code text, parent_id uuid, is_group boolean,
  revenue numeric, cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric,
  trip_count bigint, bus_count bigint, driver_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
  SELECT SUM(
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(r_agg.rev, 0)
    END
  )
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  LEFT JOIN (
    SELECT r.schedule_id, SUM(r.total_price) AS rev
    FROM reservations r WHERE r.status IN ('confirmee','utilisee')
    GROUP BY r.schedule_id
  ) r_agg ON r_agg.schedule_id = s.id
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE b.company_id = co.id
  AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
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


-- ═══════════════════════════════════════════════════════════════════
-- 8. get_daf_revenue_by_bus
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_daf_revenue_by_bus(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  company_id uuid, company_name text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
IF NOT is_daf_user() THEN RETURN; END IF;

RETURN QUERY
WITH sched_rev AS (
  SELECT s.id AS sid, s.bus_id AS s_bus_id,
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END AS srev
  FROM schedules s
  LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.id, s.bus_id, s.status, cv.amount
),
base AS (
SELECT
b.id AS bus_id,
b.registration_number,
b.model,
b.company_id,
co.name AS company_name,
COUNT(DISTINCT sr.sid)::bigint AS trip_count,
COALESCE(SUM(sr.srev), 0) AS revenue,
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
JOIN sched_rev sr ON sr.s_bus_id = b.id
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


-- ═══════════════════════════════════════════════════════════════════
-- 9. get_daf_daily_series
-- ═══════════════════════════════════════════════════════════════════
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
sched_rev AS (
  SELECT s.id AS sid, s.departure_datetime::date AS d,
    CASE WHEN s.status = 'convoi' THEN COALESCE(cv.amount, 0)
         ELSE COALESCE(SUM(r.total_price), 0)
    END AS srev
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  LEFT JOIN reservations r ON r.schedule_id = s.id AND r.status IN ('confirmee','utilisee')
  LEFT JOIN convoys cv ON cv.schedule_id = s.id
  WHERE b.company_id = ANY(p_company_ids)
  AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.id, s.departure_datetime::date, s.status, cv.amount
),
rev AS (
SELECT sr.d, SUM(sr.srev) AS rev
FROM sched_rev sr GROUP BY sr.d
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
