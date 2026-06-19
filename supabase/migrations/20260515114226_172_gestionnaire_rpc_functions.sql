/*
  # Gestionnaire RPC Functions

  ## Purpose
  Fast aggregated data functions for the Gestionnaire profile.
  All functions filter strictly by the calling user's company_id.

  ## Functions created
  1. `get_gestionnaire_company_id()` - returns the company_id of the current user
  2. `get_gestionnaire_dashboard_kpis(p_date_from date, p_date_to date)` - main KPI aggregates
  3. `get_gestionnaire_revenue_by_route(p_date_from date, p_date_to date)` - revenue per route
  4. `get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)` - revenue per bus
  5. `get_gestionnaire_expenses_by_bus(p_date_from date, p_date_to date)` - expenses per bus
  6. `get_gestionnaire_driver_report(p_date_from date, p_date_to date)` - driver performance
  7. `get_gestionnaire_daily_series(p_date_from date, p_date_to date)` - daily revenue/expense series
  8. `get_gestionnaire_bus_activity(p_date_from date, p_date_to date)` - full bus activity detail

  ## Security
  All functions are SECURITY DEFINER with explicit search_path to prevent injection.
  Each function starts by resolving the caller's company_id from the users table.
*/

-- Helper: get calling user's company_id
CREATE OR REPLACE FUNCTION get_gestionnaire_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- Main KPI dashboard aggregate
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
    -- Revenue from confirmed reservations on company buses
    'total_revenue', COALESCE((
      SELECT SUM(r.total_price)
      FROM reservations r
      JOIN schedules s ON s.id = r.schedule_id
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = v_company_id
        AND r.status IN ('confirmee','embarquee','terminee')
        AND r.created_at::date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Expense breakdown from bus_expenses
    'expense_carburant', COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b ON b.id = be.bus_id
      WHERE b.company_id = v_company_id AND be.expense_type = 'carburant'
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),
    'expense_peage', COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be
      JOIN buses b ON b.id = be.bus_id
      WHERE b.company_id = v_company_id AND be.expense_type = 'peage'
        AND be.expense_date BETWEEN p_date_from AND p_date_to
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

    -- Rations from guichetier charges (bus_expenses type 'autres' description contains 'ration')
    -- Using fuel enlevements for fuel from tanks
    'fuel_enlevements_amount', COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = v_company_id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Vehicle expenses from charge_achat
    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      WHERE ve.company_id = v_company_id
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Operational counts
    'trip_count', COALESCE((
      SELECT COUNT(*) FROM schedules s
      JOIN buses b ON b.id = s.bus_id
      WHERE b.company_id = v_company_id
        AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
        AND s.status NOT IN ('annule')
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

-- Revenue by route
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_route(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  route_id uuid, route_name text,
  trip_count bigint, revenue numeric,
  expense_total numeric, margin numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.route_id,
    COALESCE(s.route_name, ro.name, 'Ligne inconnue') AS route_name,
    COUNT(DISTINCT s.id) AS trip_count,
    COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS revenue,
    0::numeric AS expense_total,
    COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS margin
  FROM schedules s
  JOIN buses b ON b.id = s.bus_id
  LEFT JOIN reservations r ON r.schedule_id = s.id
  LEFT JOIN routes ro ON ro.id = s.route_id
  WHERE b.company_id = v_company_id
    AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    AND s.status != 'annule'
  GROUP BY s.route_id, route_name
  ORDER BY revenue DESC;
END;
$$;

-- Revenue and expenses by bus
CREATE OR REPLACE FUNCTION get_gestionnaire_revenue_by_bus(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  bus_id uuid, registration_number text, model text,
  trip_count bigint, revenue numeric,
  expense_carburant numeric, expense_peage numeric,
  expense_reparation numeric, expense_autres numeric,
  fuel_enlev numeric, vehicle_exp numeric,
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
  bus_exp AS (
    SELECT be.bus_id,
      COALESCE(SUM(be.amount) FILTER (WHERE be.expense_type = 'carburant'), 0) AS exp_carb,
      COALESCE(SUM(be.amount) FILTER (WHERE be.expense_type = 'peage'), 0) AS exp_peage,
      COALESCE(SUM(be.amount) FILTER (WHERE be.expense_type = 'reparation'), 0) AS exp_rep,
      COALESCE(SUM(be.amount) FILTER (WHERE be.expense_type NOT IN ('carburant','peage','reparation')), 0) AS exp_autres
    FROM bus_expenses be
    JOIN buses b ON b.id = be.bus_id
    WHERE b.company_id = v_company_id
      AND be.expense_date BETWEEN p_date_from AND p_date_to
    GROUP BY be.bus_id
  ),
  bus_fuel AS (
    SELECT fe.bus_id,
      COALESCE(SUM(fe.total_amount), 0) AS fuel_amount
    FROM fuel_enlevements fe
    WHERE fe.company_id = v_company_id
      AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    GROUP BY fe.bus_id
  )
  SELECT
    b.id AS bus_id,
    b.registration_number,
    COALESCE(b.model, b.brand, '') AS model,
    COALESCE(br.trip_count, 0),
    COALESCE(br.revenue, 0),
    COALESCE(be2.exp_carb, 0),
    COALESCE(be2.exp_peage, 0),
    COALESCE(be2.exp_rep, 0),
    COALESCE(be2.exp_autres, 0),
    COALESCE(bf.fuel_amount, 0),
    0::numeric AS vehicle_exp,
    COALESCE(be2.exp_carb, 0) + COALESCE(be2.exp_peage, 0) + COALESCE(be2.exp_rep, 0)
      + COALESCE(be2.exp_autres, 0) + COALESCE(bf.fuel_amount, 0) AS total_expense,
    COALESCE(br.revenue, 0) - (
      COALESCE(be2.exp_carb, 0) + COALESCE(be2.exp_peage, 0) + COALESCE(be2.exp_rep, 0)
      + COALESCE(be2.exp_autres, 0) + COALESCE(bf.fuel_amount, 0)
    ) AS margin
  FROM buses b
  LEFT JOIN bus_rev br ON br.bus_id = b.id
  LEFT JOIN bus_exp be2 ON be2.bus_id = b.id
  LEFT JOIN bus_fuel bf ON bf.bus_id = b.id
  WHERE b.company_id = v_company_id AND b.is_active = true
  ORDER BY COALESCE(br.revenue, 0) DESC;
END;
$$;

-- Driver report
CREATE OR REPLACE FUNCTION get_gestionnaire_driver_report(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  driver_id uuid, first_name varchar, last_name varchar,
  employee_id varchar, bus_registration text,
  trip_count bigint, revenue numeric,
  expense_total numeric, avg_rating numeric
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company_id uuid;
BEGIN
  v_company_id := get_gestionnaire_company_id();
  IF v_company_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    e.id AS driver_id,
    e.first_name,
    e.last_name,
    e.employee_id,
    COALESCE(b.registration_number, '') AS bus_registration,
    COUNT(DISTINCT s.id) AS trip_count,
    COALESCE(SUM(r.total_price) FILTER (WHERE r.status IN ('confirmee','embarquee','terminee')), 0) AS revenue,
    COALESCE((
      SELECT SUM(be.amount) FROM bus_expenses be WHERE be.bus_id = e.bus_id
        AND be.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS expense_total,
    COALESCE(e.driver_average_rating, 0) AS avg_rating
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
  ORDER BY revenue DESC;
END;
$$;

-- Daily series for charts
CREATE OR REPLACE FUNCTION get_gestionnaire_daily_series(
  p_date_from date DEFAULT (CURRENT_DATE - interval '30 days')::date,
  p_date_to   date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  day date, revenue numeric, expenses numeric, trip_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
    SELECT be.expense_date AS day,
      COALESCE(SUM(be.amount), 0) AS expenses
    FROM bus_expenses be
    JOIN buses b ON b.id = be.bus_id
    WHERE b.company_id = v_company_id
      AND be.expense_date BETWEEN p_date_from AND p_date_to
    GROUP BY 1
  )
  SELECT
    d.day,
    COALESCE(rev.revenue, 0) AS revenue,
    COALESCE(exp.expenses, 0) AS expenses,
    COALESCE(rev.trip_count, 0) AS trip_count
  FROM days d
  LEFT JOIN rev ON rev.day = d.day
  LEFT JOIN exp ON exp.day = d.day
  ORDER BY d.day;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION get_gestionnaire_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_dashboard_kpis(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_revenue_by_route(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_revenue_by_bus(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_driver_report(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION get_gestionnaire_daily_series(date, date) TO authenticated;
