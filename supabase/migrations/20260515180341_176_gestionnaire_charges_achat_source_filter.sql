/*
  # Filter "Charges achat" in gestionnaire to source = 'charge_achat' only

  ## Change
  - `get_gestionnaire_dashboard_kpis`: adds `AND ve.source = 'charge_achat'` to
    the vehicle_expenses subquery so "Charges achat" only reflects entries created
    by the Chargé Achat role, not Comptable entries.

  ## Why
  After adding the `source` column to `vehicle_expenses`, the gestionnaire KPI
  was still summing both sources (charge_achat + comptable), mixing two distinct
  cost categories. This migration restricts the figure to charge_achat only.
*/

CREATE OR REPLACE FUNCTION public.get_gestionnaire_dashboard_kpis(p_date_from date, p_date_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_company_id uuid;
v_result jsonb;
BEGIN
v_company_id := get_gestionnaire_company_id();
IF v_company_id IS NULL THEN RETURN '{}'::jsonb; END IF;

SELECT jsonb_build_object(
'total_revenue',           COALESCE(SUM(r.total_price), 0),
'trip_count',              COUNT(DISTINCT s.id),
'active_bus_count',        COUNT(DISTINCT s.bus_id),
'driver_count',            COUNT(DISTINCT s.driver_id),

-- Guichetier charges from counter_charges (filtered by charge_date)
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

-- Fuel from tank (enlevements) — use enlevement_date
'fuel_enlevements_amount', COALESCE((
SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
WHERE fe.company_id = v_company_id
AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
), 0),

-- Bus maintenance/repairs (bus_expenses, all types)
'expense_reparation', COALESCE((
SELECT SUM(be.amount) FROM bus_expenses be
JOIN buses b3 ON b3.id = be.bus_id
WHERE b3.company_id = v_company_id
AND be.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Vehicle/purchase expenses — charge_achat source only
'vehicle_expenses_amount', COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.company_id = v_company_id
AND ve.source = 'charge_achat'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

'expense_autres', 0
)
INTO v_result
FROM schedules s
JOIN buses b ON b.id = s.bus_id
JOIN reservations r ON r.schedule_id = s.id
WHERE b.company_id = v_company_id
AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
AND r.status IN ('confirmee', 'utilisee');

RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$;
