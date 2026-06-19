/*
  # Gestionnaire: séparer "Réparations" (comptable) et "Charges achat" dans les KPIs

  ## Contexte
  vehicle_expenses contient deux sources distinctes :
  - source = 'comptable'    → Autres dépenses saisies par le Comptable (réparations, stock, etc.)
  - source = 'charge_achat' → Dépenses saisies par le Chargé Achat

  ## Changement
  Remplacer le champ unique `vehicle_expenses_amount` par deux champs :
  - `expense_reparation`     : vehicle_expenses WHERE source = 'comptable'  (Autres dépenses Comptable)
  - `vehicle_expenses_amount`: vehicle_expenses WHERE source = 'charge_achat' (Chargé Achat)

  Le champ `expense_reparation` précédent (bus_expenses hors carburant) est désormais
  remplacé par cette nouvelle définition.

  ## Fonctions modifiées
  - get_gestionnaire_dashboard_kpis
  - get_gestionnaire_revenue_by_bus (vehicle_exp = charge_achat, expense_reparation = comptable)
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

-- Réparations = Autres dépenses saisies par le Comptable (source = 'comptable')
'expense_reparation', COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.company_id = v_company_id
AND ve.source = 'comptable'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Charges achat = dépenses saisies par le Chargé Achat (source = 'charge_achat')
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
-- Réparations = Autres dépenses Comptable (source = 'comptable')
COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.registration_number = b.registration_number
AND ve.source = 'comptable'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0) AS expense_reparation,
-- Charges achat (source = 'charge_achat')
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
