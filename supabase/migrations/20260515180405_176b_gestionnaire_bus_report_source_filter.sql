/*
  # Filter vehicle_expenses by source = 'charge_achat' in get_gestionnaire_revenue_by_bus

  Same fix as migration 176: ensures the "Charges achat" column in the bus
  performance report only counts charge_achat entries, not comptable entries.
*/

CREATE OR REPLACE FUNCTION public.get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)
RETURNS TABLE(bus_id uuid, registration_number text, model text, trip_count bigint, revenue numeric, cc_carburant numeric, cc_ration numeric, cc_peage numeric, fuel_enlev numeric, expense_reparation numeric, vehicle_exp numeric, total_expense numeric, margin numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
AND ve.source = 'charge_achat'
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
$function$;
