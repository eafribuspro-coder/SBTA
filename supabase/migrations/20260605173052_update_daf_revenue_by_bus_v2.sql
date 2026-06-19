
DROP FUNCTION IF EXISTS get_daf_revenue_by_bus(uuid[], date, date);

CREATE OR REPLACE FUNCTION get_daf_revenue_by_bus(
  p_company_ids uuid[],
  p_date_from date,
  p_date_to date
)
RETURNS TABLE(
  bus_id uuid,
  registration_number text,
  model text,
  company_id uuid,
  company_name text,
  main_station text,
  trip_count bigint,
  total_passengers bigint,
  avg_fill_rate numeric,
  revenue numeric,
  cc_carburant numeric,
  cc_ration numeric,
  cc_peage numeric,
  fuel_enlev numeric,
  expense_reparation numeric,
  expense_autres numeric,
  vehicle_exp numeric,
  fuel_carburant_comptable numeric,
  total_expense numeric,
  margin numeric,
  breakdown_received numeric,
  breakdown_transferred numeric
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
IF NOT is_daf_user() THEN RETURN; END IF;

RETURN QUERY
WITH scr AS (
  SELECT * FROM schedule_company_revenue(p_date_from, p_date_to)
  WHERE company_id = ANY(p_company_ids)
),
scc AS (
  SELECT * FROM schedule_company_charges(p_date_from, p_date_to)
  WHERE company_id = ANY(p_company_ids)
),
sched_info AS (
  SELECT
    s.id AS schedule_id,
    s.bus_id,
    s.departure_station_id,
    COALESCE(s.seats_reserved, 0) AS seats_reserved,
    COALESCE(s.fill_rate, 0) AS fill_rate
  FROM schedules s
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
),
agg AS (
  SELECT scr.bus_id, scr.company_id,
    COUNT(DISTINCT scr.sid)::bigint AS trip_count,
    COALESCE(SUM(scr.revenue), 0) AS revenue,
    COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0) AS breakdown_received,
    COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0) AS breakdown_transferred
  FROM scr
  GROUP BY scr.bus_id, scr.company_id
),
bus_sched_stats AS (
  SELECT
    si.bus_id,
    COALESCE(SUM(si.seats_reserved), 0)::bigint AS total_passengers,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(si.fill_rate), 1) ELSE 0 END AS avg_fill_rate,
    (SELECT st.name FROM stations st WHERE st.id = mode() WITHIN GROUP (ORDER BY si.departure_station_id)) AS main_station
  FROM sched_info si
  JOIN buses b2 ON b2.id = si.bus_id
  WHERE b2.company_id = ANY(p_company_ids)
  GROUP BY si.bus_id
),
cc_agg AS (
  SELECT scc.bus_id, scc.company_id,
    COALESCE(SUM(scc.cc_carburant), 0) AS cc_carburant,
    COALESCE(SUM(scc.cc_ration), 0)    AS cc_ration,
    COALESCE(SUM(scc.cc_peage), 0)     AS cc_peage
  FROM scc
  GROUP BY scc.bus_id, scc.company_id
),
base AS (
  SELECT
    b.id AS bus_id, b.registration_number, b.model,
    a.company_id, co.name AS company_name,
    COALESCE(bss.main_station, '') AS main_station,
    a.trip_count, 
    COALESCE(bss.total_passengers, 0)::bigint AS total_passengers,
    COALESCE(bss.avg_fill_rate, 0) AS avg_fill_rate,
    a.revenue, a.breakdown_received, a.breakdown_transferred,
    COALESCE(cca.cc_carburant, 0) AS cc_carburant,
    COALESCE(cca.cc_ration, 0)    AS cc_ration,
    COALESCE(cca.cc_peage, 0)     AS cc_peage,
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
  LEFT JOIN bus_sched_stats bss ON bss.bus_id = b.id
  LEFT JOIN cc_agg cca ON cca.bus_id = b.id AND cca.company_id = a.company_id
)
SELECT base.bus_id, base.registration_number, base.model,
  base.company_id, base.company_name, base.main_station,
  base.trip_count, base.total_passengers, base.avg_fill_rate,
  base.revenue,
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
