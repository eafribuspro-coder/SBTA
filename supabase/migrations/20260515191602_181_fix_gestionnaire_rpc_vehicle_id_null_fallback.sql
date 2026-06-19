/*
  # Fix: vehicle_expenses avec vehicle_id NULL exclus du RPC Gestionnaire

  ## Problème
  Quand le Comptable saisit une sortie de stock, vehicle_id peut être NULL
  si la résolution du véhicule échoue. La jointure INNER sur fleet_vehicles
  exclut alors la ligne, même si registration_number est renseigné et
  correspond à un véhicule connu.

  ## Fix
  Remplacer `JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id` par une
  résolution en deux étapes :
    1. Si vehicle_id IS NOT NULL → jointure directe
    2. Si vehicle_id IS NULL     → jointure via registration_number

  On utilise COALESCE pour obtenir la company_id dans les deux cas.

  ## Fonctions modifiées
  - get_gestionnaire_dashboard_kpis  (sous-queries expense_reparation, vehicle_expenses_amount, expense_autres)
  - get_gestionnaire_revenue_by_bus  (sous-queries expense_reparation, vehicle_exp)
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

-- Réparations = dépenses Comptable hors sorties stock
-- Résolution company_id via vehicle_id ou registration_number
'expense_reparation', COALESCE((
SELECT SUM(ve.amount)
FROM vehicle_expenses ve
LEFT JOIN fleet_vehicles fv_direct ON fv_direct.id = ve.vehicle_id
LEFT JOIN fleet_vehicles fv_reg    ON fv_reg.registration_number = ve.registration_number
  AND ve.vehicle_id IS NULL
WHERE COALESCE(fv_direct.company_id, fv_reg.company_id) = v_company_id
AND ve.source = 'comptable'
AND ve.description NOT LIKE 'Sortie stock — %'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Charges achat
'vehicle_expenses_amount', COALESCE((
SELECT SUM(ve.amount)
FROM vehicle_expenses ve
LEFT JOIN fleet_vehicles fv_direct ON fv_direct.id = ve.vehicle_id
LEFT JOIN fleet_vehicles fv_reg    ON fv_reg.registration_number = ve.registration_number
  AND ve.vehicle_id IS NULL
WHERE COALESCE(fv_direct.company_id, fv_reg.company_id) = v_company_id
AND ve.source = 'charge_achat'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Articles stock = sorties de stock Comptable
'expense_autres', COALESCE((
SELECT SUM(ve.amount)
FROM vehicle_expenses ve
LEFT JOIN fleet_vehicles fv_direct ON fv_direct.id = ve.vehicle_id
LEFT JOIN fleet_vehicles fv_reg    ON fv_reg.registration_number = ve.registration_number
  AND ve.vehicle_id IS NULL
WHERE COALESCE(fv_direct.company_id, fv_reg.company_id) = v_company_id
AND ve.source = 'comptable'
AND ve.description LIKE 'Sortie stock — %'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0)
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
-- Réparations = dépenses Comptable hors sorties stock (vehicle_id ou registration_number)
COALESCE((
SELECT SUM(ve.amount)
FROM vehicle_expenses ve
LEFT JOIN fleet_vehicles fv_direct ON fv_direct.id = ve.vehicle_id
LEFT JOIN fleet_vehicles fv_reg    ON fv_reg.registration_number = ve.registration_number
  AND ve.vehicle_id IS NULL
WHERE (fv_direct.registration_number = b.registration_number
       OR (ve.vehicle_id IS NULL AND ve.registration_number = b.registration_number))
AND ve.source = 'comptable'
AND ve.description NOT LIKE 'Sortie stock — %'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0) AS expense_reparation,
-- Charges achat
COALESCE((
SELECT SUM(ve.amount)
FROM vehicle_expenses ve
LEFT JOIN fleet_vehicles fv_direct ON fv_direct.id = ve.vehicle_id
LEFT JOIN fleet_vehicles fv_reg    ON fv_reg.registration_number = ve.registration_number
  AND ve.vehicle_id IS NULL
WHERE (fv_direct.registration_number = b.registration_number
       OR (ve.vehicle_id IS NULL AND ve.registration_number = b.registration_number))
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
