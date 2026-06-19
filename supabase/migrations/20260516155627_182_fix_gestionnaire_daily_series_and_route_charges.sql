/*
  # Fix: RPCs Gestionnaire — daily_series et revenue_by_route

  ## Problèmes corrigés

  ### 1. get_gestionnaire_daily_series
  La sous-requête counter_charges utilisait une corrélation directe
  `cc.charge_date = s.departure_datetime::date` dans un SELECT groupé,
  ce qui est invalide en SQL (colonne non groupée). Les expenses étaient
  toujours 0. Fix : pré-agréger les charges par date dans un CTE.

  ### 2. get_gestionnaire_revenue_by_route
  Les sous-requêtes counter_charges par schedule_id dans un GROUP BY
  donnaient des doublons. Fix : pré-agréger les charges par schedule_id
  via un CTE, puis sommer par route.
*/

-- ─────────────────────────────────────────────
-- daily_series : CTE pour les charges guichet
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gestionnaire_daily_series(p_date_from date, p_date_to date)
RETURNS TABLE(day date, revenue numeric, expenses numeric, trip_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
revenue_by_day AS (
  SELECT
    s.departure_datetime::date AS rday,
    COALESCE(SUM(r.total_price), 0) AS total_revenue,
    COUNT(DISTINCT s.id)::bigint AS trip_count
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
  LEFT JOIN reservations r ON r.schedule_id = s.id
    AND r.status IN ('confirmee', 'utilisee')
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
  GROUP BY s.departure_datetime::date
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
$function$;


-- ─────────────────────────────────────────────
-- revenue_by_route : CTE pour les charges guichet
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gestionnaire_revenue_by_route(p_date_from date, p_date_to date)
RETURNS TABLE(route_id uuid, route_name text, trip_count bigint, revenue numeric,
              cc_carburant numeric, cc_ration numeric, cc_peage numeric,
              fuel_enlev numeric, expense_reparation numeric,
              total_expense numeric, margin numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT r.schedule_id, COALESCE(SUM(r.total_price), 0) AS total
  FROM reservations r
  JOIN sched ON sched.sid = r.schedule_id
  WHERE r.status IN ('confirmee', 'utilisee')
  GROUP BY r.schedule_id
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
$function$;
