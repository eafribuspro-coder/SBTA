/*
  # Gestionnaire: "Autres" = Articles depuis le stock (Comptable)

  ## Contexte
  Les sorties de stock enregistrées par le Comptable dans vehicle_expenses sont
  identifiables par : source = 'comptable' AND description LIKE 'Sortie stock — %'
  (category_id est NULL pour ces entrées).

  Les autres dépenses comptable (réparations, divers, etc.) ont category_id NOT NULL
  ou une description libre ne commençant pas par 'Sortie stock —'.

  ## Changement
  Scinder le sous-total source='comptable' en deux dans les deux RPC Gestionnaire :

  - expense_reparation : source='comptable' AND description NOT LIKE 'Sortie stock — %'
    → Réparations / dépenses diverses du Comptable

  - expense_autres     : source='comptable' AND description LIKE 'Sortie stock — %'
    → Articles depuis le stock (Comptable)

  vehicle_expenses_amount reste inchangé = source='charge_achat' (Chargé Achat)

  ## Fonctions modifiées
  - get_gestionnaire_dashboard_kpis
  - get_gestionnaire_revenue_by_bus
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

-- Réparations = Autres dépenses Comptable hors sorties de stock
'expense_reparation', COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.company_id = v_company_id
AND ve.source = 'comptable'
AND ve.description NOT LIKE 'Sortie stock — %'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Charges achat = dépenses saisies par le Chargé Achat
'vehicle_expenses_amount', COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.company_id = v_company_id
AND ve.source = 'charge_achat'
AND ve.expense_date BETWEEN p_date_from AND p_date_to
), 0),

-- Autres = Articles depuis le stock (Comptable)
'expense_autres', COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.company_id = v_company_id
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
-- Réparations = dépenses Comptable hors sorties stock
COALESCE((
SELECT SUM(ve.amount) FROM vehicle_expenses ve
JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
WHERE fv.registration_number = b.registration_number
AND ve.source = 'comptable'
AND ve.description NOT LIKE 'Sortie stock — %'
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
