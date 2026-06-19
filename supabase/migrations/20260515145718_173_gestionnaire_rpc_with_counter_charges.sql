/*
  # Mise à jour fonctions RPC Gestionnaire — sources counter_charges

  ## Changements
  - Drop + recréation des fonctions avec nouvelles colonnes
  - "Carburant (BE)" → "Carburant compl." depuis counter_charges.charge_type = 'carburant_complement'
  - Ajout "Ration" depuis counter_charges.charge_type = 'ration'
  - "Péage guichet" depuis counter_charges.charge_type = 'peage'
  - Carburant cuve = fuel_enlevements (inchangé)
  - Réparations = bus_expenses (inchangé)
  - Charges achat = vehicle_expenses (inchangé)
*/

DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_bus(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_revenue_by_route(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_daily_series(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_driver_report(date, date);
DROP FUNCTION IF EXISTS get_gestionnaire_dashboard_kpis(date, date);

-- KPIs principal
CREATE OR REPLACE FUNCTION get_gestionnaire_dashboard_kpis(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id uuid;
  v_result jsonb;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE((
      SELECT SUM(r.total_price)
      FROM reservations r
      JOIN schedules s ON s.id = r.schedule_id
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = v_company_id
        AND r.status IN ('confirmee','embarquee','terminee')
        AND r.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_carburant_complement', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = v_company_id AND cc.charge_type = 'carburant_complement'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_ration', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = v_company_id AND cc.charge_type = 'ration'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'cc_peage', COALESCE((
      SELECT SUM(cc.amount) FROM counter_charges cc
      JOIN buses b ON b.id = cc.bus_id
      WHERE b.company_id = v_company_id AND cc.charge_type = 'peage'
        AND cc.charge_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = v_company_id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'expense_reparation', COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b ON b.id = be.bus_id
      WHERE b.company_id = v_company_id AND be.expense_type = 'reparation'
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'expense_autres', COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b ON b.id = be.bus_id
      WHERE b.company_id = v_company_id
        AND be.expense_type NOT IN ('carburant','peage','reparation')
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      WHERE ve.company_id = v_company_id
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'trip_count', COALESCE((
      SELECT COUNT(*) FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = v_company_id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND s.status != 'annule'
    ), 0),
    'active_bus_count', COALESCE((
      SELECT COUNT(*) FROM buses WHERE company_id = v_company_id AND is_active = true
    ), 0),
    'driver_count', COALESCE((
      SELECT COUNT(*) FROM employees
      WHERE company_id = v_company_id AND role = 'chauffeur'
        AND (account_status IS NULL OR account_status != 'desactive')
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Revenue par bus
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_bus(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, vehicle_exp numeric,
  total_expense numeric, margin numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH bus_rev AS (
    SELECT s.bus_id,
      COUNT(DISTINCT s.id) AS trip_count,
      COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS revenue
    FROM schedules s
    LEFT JOIN reservations r ON r.schedule_id = s.id
    JOIN buses b ON b.id = s.bus_id
    WHERE b.company_id = v_company_id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
      AND s.status != 'annule'
    GROUP BY s.bus_id
  ),
  bus_cc AS (
    SELECT cc.bus_id,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'carburant_complement'), 0) AS cc_carb,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'ration'), 0) AS cc_rat,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'peage'), 0) AS cc_p
    FROM counter_charges cc
    JOIN buses b ON b.id = cc.bus_id
    WHERE b.company_id = v_company_id
      AND cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY cc.bus_id
  ),
  bus_fuel AS (
    SELECT fe.bus_id,
      COALESCE(SUM(fe.total_amount), 0) AS fuel_amount
    FROM fuel_enlevements fe
    WHERE fe.company_id = v_company_id
      AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    GROUP BY fe.bus_id
  ),
  bus_exp AS (
    SELECT be.bus_id,
      COALESCE(SUM(be.amount) FILTER (WHERE be.expense_type = 'reparation'), 0) AS exp_rep
    FROM bus_expenses be
    JOIN buses b ON b.id = be.bus_id
    WHERE b.company_id = v_company_id
      AND be.expense_date BETWEEN p_date_from AND p_date_to
    GROUP BY be.bus_id
  )
  SELECT
    b.id,
    b.registration_number,
    COALESCE(b.model, b.brand, '') AS model,
    COALESCE(br.trip_count, 0),
    COALESCE(br.revenue, 0),
    COALESCE(bcc.cc_carb, 0),
    COALESCE(bcc.cc_rat, 0),
    COALESCE(bcc.cc_p, 0),
    COALESCE(bf.fuel_amount, 0),
    COALESCE(be2.exp_rep, 0),
    0::numeric,
    COALESCE(bcc.cc_carb, 0) + COALESCE(bcc.cc_rat, 0) + COALESCE(bcc.cc_p, 0)
      + COALESCE(bf.fuel_amount, 0) + COALESCE(be2.exp_rep, 0),
    COALESCE(br.revenue, 0) - (
      COALESCE(bcc.cc_carb, 0) + COALESCE(bcc.cc_rat, 0) + COALESCE(bcc.cc_p, 0)
      + COALESCE(bf.fuel_amount, 0) + COALESCE(be2.exp_rep, 0)
    )
  FROM buses b
  LEFT JOIN bus_rev br ON br.bus_id = b.id
  LEFT JOIN bus_cc bcc ON bcc.bus_id = b.id
  LEFT JOIN bus_fuel bf ON bf.bus_id = b.id
  LEFT JOIN bus_exp be2 ON be2.bus_id = b.id
  WHERE b.company_id = v_company_id AND b.is_active = true
  ORDER BY COALESCE(br.revenue, 0) DESC;
END;
$$;

-- Revenue par route
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_route(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  route_id uuid, route_name text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric,
  total_expense numeric, margin numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH sched AS (
    SELECT
      s.id AS sid,
      s.route_id,
      COALESCE(s.route_name, ro.name, 'Ligne inconnue') AS rname,
      s.bus_id,
      COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS revenue
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id
    LEFT JOIN reservations r ON r.schedule_id = s.id
    LEFT JOIN routes ro ON ro.id = s.route_id
    WHERE b.company_id = v_company_id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
      AND s.status != 'annule'
    GROUP BY s.id, s.route_id, rname, s.bus_id
  ),
  sched_cc AS (
    SELECT cc.schedule_id AS sid,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'carburant_complement'), 0) AS cc_carb,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'ration'), 0) AS cc_rat,
      COALESCE(SUM(cc.amount) FILTER (WHERE cc.charge_type = 'peage'), 0) AS cc_p
    FROM counter_charges cc
    WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY cc.schedule_id
  )
  SELECT
    s.route_id,
    s.rname AS route_name,
    COUNT(DISTINCT s.sid)::bigint AS trip_count,
    SUM(s.revenue) AS revenue,
    COALESCE(SUM(sc.cc_carb), 0) AS cc_carburant,
    COALESCE(SUM(sc.cc_rat), 0) AS cc_ration,
    COALESCE(SUM(sc.cc_p), 0) AS cc_peage,
    0::numeric AS fuel_enlev,
    0::numeric AS expense_reparation,
    COALESCE(SUM(sc.cc_carb), 0) + COALESCE(SUM(sc.cc_rat), 0) + COALESCE(SUM(sc.cc_p), 0) AS total_expense,
    SUM(s.revenue) - COALESCE(SUM(sc.cc_carb), 0) - COALESCE(SUM(sc.cc_rat), 0) - COALESCE(SUM(sc.cc_p), 0) AS margin
  FROM sched s
  LEFT JOIN sched_cc sc ON sc.sid = s.sid
  GROUP BY s.route_id, s.rname
  ORDER BY SUM(s.revenue) DESC;
END;
$$;

-- Série journalière
CREATE OR REPLACE FUNCTION get_gestionnaire_daily_series(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(day date, revenue numeric, expenses numeric, trip_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(p_date_from, p_date_to, interval '1 day')::date AS day
  ),
  rev AS (
    SELECT s.departure_datetime::date AS day,
      COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS revenue,
      COUNT(DISTINCT s.id) AS trip_count
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id
    LEFT JOIN reservations r ON r.schedule_id = s.id
    WHERE b.company_id = v_company_id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
      AND s.status != 'annule'
    GROUP BY 1
  ),
  exp AS (
    SELECT cc.charge_date AS day,
      COALESCE(SUM(cc.amount), 0) AS expenses
    FROM counter_charges cc
    JOIN buses b ON b.id = cc.bus_id
    WHERE b.company_id = v_company_id
      AND cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  )
  SELECT d.day, COALESCE(rev.revenue, 0), COALESCE(exp.expenses, 0), COALESCE(rev.trip_count, 0)
  FROM days d
  LEFT JOIN rev ON rev.day = d.day
  LEFT JOIN exp ON exp.day = d.day
  ORDER BY d.day;
END;
$$;

-- Rapport chauffeurs
CREATE OR REPLACE FUNCTION get_gestionnaire_driver_report(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  driver_id uuid, first_name varchar, last_name varchar,
  employee_id varchar, bus_registration text,
  trip_count bigint, revenue numeric,
  cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  expense_total numeric, avg_rating numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.first_name,
    e.last_name,
    e.employee_id,
    COALESCE(b.registration_number, ''),
    COUNT(DISTINCT s.id),
    COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0),
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = e.bus_id AND cc.charge_type = 'carburant_complement' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0),
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = e.bus_id AND cc.charge_type = 'ration' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0),
    COALESCE((SELECT SUM(cc.amount) FROM counter_charges cc WHERE cc.bus_id = e.bus_id AND cc.charge_type = 'peage' AND cc.charge_date BETWEEN p_date_from AND p_date_to), 0),
    COALESCE((SELECT SUM(cc2.amount) FROM counter_charges cc2 WHERE cc2.bus_id = e.bus_id AND cc2.charge_date BETWEEN p_date_from AND p_date_to), 0),
    COALESCE(e.driver_average_rating, 0)
  FROM employees e
  JOIN buses b ON b.id = e.bus_id
  LEFT JOIN schedules s ON s.driver_id = e.auth_user_id
    AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    AND s.status != 'annule'
  LEFT JOIN reservations r ON r.schedule_id = s.id
  WHERE e.company_id = v_company_id
    AND e.role = 'chauffeur'
    AND (e.account_status IS NULL OR e.account_status != 'desactive')
  GROUP BY e.id, e.first_name, e.last_name, e.employee_id, b.registration_number
  ORDER BY COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_gestionnaire_dashboard_kpis(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_revenue_by_bus(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_revenue_by_route(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_daily_series(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_driver_report(date, date) TO authenticated;
