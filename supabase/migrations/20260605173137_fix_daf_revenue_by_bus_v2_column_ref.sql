
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
    s.id AS sched_id,
    s.bus_id AS si_bus_id,
    s.departure_station_id,
    COALESCE(s.seats_reserved, 0) AS seats_reserved,
    COALESCE(s.fill_rate, 0) AS sched_fill_rate
  FROM schedules s
  WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
),
agg AS (
  SELECT scr.bus_id AS agg_bus_id, scr.company_id AS agg_company_id,
    COUNT(DISTINCT scr.schedule_id)::bigint AS agg_trip_count,
    COALESCE(SUM(scr.revenue), 0) AS agg_revenue,
    COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0) AS agg_breakdown_received,
    COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0) AS agg_breakdown_transferred
  FROM scr
  GROUP BY scr.bus_id, scr.company_id
),
bus_sched_stats AS (
  SELECT
    si.si_bus_id AS bss_bus_id,
    COALESCE(SUM(si.seats_reserved), 0)::bigint AS bss_total_passengers,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(si.sched_fill_rate), 1) ELSE 0 END AS bss_avg_fill_rate,
    (
      SELECT st.name FROM stations st 
      WHERE st.id = (
        SELECT si2.departure_station_id 
        FROM sched_info si2 
        WHERE si2.si_bus_id = si.si_bus_id 
        GROUP BY si2.departure_station_id 
        ORDER BY count(*) DESC 
        LIMIT 1
      )
    ) AS bss_main_station
  FROM sched_info si
  JOIN buses b2 ON b2.id = si.si_bus_id
  WHERE b2.company_id = ANY(p_company_ids)
  GROUP BY si.si_bus_id
),
cc_agg AS (
  SELECT scc.bus_id AS cca_bus_id, scc.company_id AS cca_company_id,
    COALESCE(SUM(scc.cc_carburant), 0) AS cca_cc_carburant,
    COALESCE(SUM(scc.cc_ration), 0)    AS cca_cc_ration,
    COALESCE(SUM(scc.cc_peage), 0)     AS cca_cc_peage
  FROM scc
  GROUP BY scc.bus_id, scc.company_id
),
base AS (
  SELECT
    b.id AS b_bus_id, b.registration_number AS b_reg, b.model AS b_model,
    a.agg_company_id AS b_company_id, co.name AS b_company_name,
    COALESCE(bss.bss_main_station, '') AS b_main_station,
    a.agg_trip_count AS b_trip_count,
    COALESCE(bss.bss_total_passengers, 0)::bigint AS b_total_passengers,
    COALESCE(bss.bss_avg_fill_rate, 0) AS b_avg_fill_rate,
    a.agg_revenue AS b_revenue,
    a.agg_breakdown_received AS b_breakdown_received,
    a.agg_breakdown_transferred AS b_breakdown_transferred,
    COALESCE(cca.cca_cc_carburant, 0) AS b_cc_carburant,
    COALESCE(cca.cca_cc_ration, 0)    AS b_cc_ration,
    COALESCE(cca.cca_cc_peage, 0)     AS b_cc_peage,
    COALESCE((SELECT SUM(fe.total_amount) FROM fuel_enlevements fe WHERE fe.bus_id = b.id AND fe.enlevement_date BETWEEN p_date_from AND p_date_to), 0) AS b_fuel_enlev,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
      AND ve.source = 'comptable'
      AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
      AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS b_expense_reparation,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
      AND ve.source = 'comptable' AND ve.description LIKE 'Sortie stock — %'
      AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS b_expense_autres,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
      AND ve.source = 'charge_achat'
      AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS b_vehicle_exp,
    COALESCE((SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw WHERE cfw.bus_id = b.id AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to), 0) AS b_fuel_carburant_comptable
  FROM buses b
  JOIN agg a ON a.agg_bus_id = b.id
  JOIN companies co ON co.id = a.agg_company_id
  LEFT JOIN bus_sched_stats bss ON bss.bss_bus_id = b.id
  LEFT JOIN cc_agg cca ON cca.cca_bus_id = b.id AND cca.cca_company_id = a.agg_company_id
)
SELECT base.b_bus_id, base.b_reg, base.b_model,
  base.b_company_id, base.b_company_name, base.b_main_station,
  base.b_trip_count, base.b_total_passengers, base.b_avg_fill_rate,
  base.b_revenue,
  base.b_cc_carburant, base.b_cc_ration, base.b_cc_peage, base.b_fuel_enlev,
  base.b_expense_reparation, base.b_expense_autres, base.b_vehicle_exp, base.b_fuel_carburant_comptable,
  (base.b_cc_carburant + base.b_cc_ration + base.b_cc_peage + base.b_fuel_enlev
   + base.b_expense_reparation + base.b_expense_autres + base.b_vehicle_exp
   + base.b_fuel_carburant_comptable) AS total_expense,
  (base.b_revenue - base.b_cc_carburant - base.b_cc_ration - base.b_cc_peage - base.b_fuel_enlev
   - base.b_expense_reparation - base.b_expense_autres - base.b_vehicle_exp
   - base.b_fuel_carburant_comptable) AS margin,
  base.b_breakdown_received, base.b_breakdown_transferred
FROM base
ORDER BY base.b_revenue DESC;
END;
$$;
