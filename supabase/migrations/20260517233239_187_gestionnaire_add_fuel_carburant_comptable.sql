/*
  # Gestionnaire: intégrer les prélèvements carburant du Comptable

  ## Contexte
  Un nouveau module Comptable permet d'enregistrer les prélèvements carburant bus
  dans la table `comptable_fuel_withdrawals`. Ces prélèvements doivent apparaître
  dans le profil Gestionnaire comme une charge supplémentaire distincte.

  ## Règle métier
  Résultat brut =
    Résultat bordereau guichetier
    - Carburant cuve (fuel_enlevements)
    - Réparations (vehicle_expenses source='comptable')
    - Charges achat (vehicle_expenses source='charge_achat')
    - Charge carburant comptable (comptable_fuel_withdrawals)
    - Autres charges

  ## Fonctions modifiées
  - get_gestionnaire_dashboard_kpis   → ajoute fuel_carburant_comptable dans le jsonb
  - get_gestionnaire_revenue_by_bus   → DROP+CREATE pour ajouter fuel_carburant_comptable
                                        par bus, inclus dans total_expense et margin
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. get_gestionnaire_dashboard_kpis — ajout fuel_carburant_comptable
-- ─────────────────────────────────────────────────────────────────────────────
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

    'expense_reparation', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
      WHERE fv.company_id = v_company_id
        AND ve.source = 'comptable'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
      WHERE fv.company_id = v_company_id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_carburant_comptable', COALESCE((
      SELECT SUM(cfw.total_amount)
      FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = v_company_id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
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


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. get_gestionnaire_revenue_by_bus — DROP + CREATE pour ajouter la colonne
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_gestionnaire_revenue_by_bus(date, date);

CREATE FUNCTION public.get_gestionnaire_revenue_by_bus(p_date_from date, p_date_to date)
RETURNS TABLE(
  bus_id                   uuid,
  registration_number      text,
  model                    text,
  trip_count               bigint,
  revenue                  numeric,
  cc_carburant             numeric,
  cc_ration                numeric,
  cc_peage                 numeric,
  fuel_enlev               numeric,
  expense_reparation       numeric,
  vehicle_exp              numeric,
  fuel_carburant_comptable numeric,
  total_expense            numeric,
  margin                   numeric
)
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
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
        WHERE fv.registration_number = b.registration_number
          AND ve.source = 'comptable'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      COALESCE((
        SELECT SUM(ve.amount) FROM vehicle_expenses ve
        JOIN fleet_vehicles fv ON fv.id = ve.vehicle_id
        WHERE fv.registration_number = b.registration_number
          AND ve.source = 'charge_achat'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS vehicle_exp,
      COALESCE((
        SELECT SUM(cfw.total_amount)
        FROM comptable_fuel_withdrawals cfw
        WHERE cfw.bus_id = b.id
          AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
      ), 0) AS fuel_carburant_comptable
    FROM buses b
    JOIN schedules s ON s.bus_id = b.id
      AND s.departure_datetime::date BETWEEN p_date_from AND p_date_to
    LEFT JOIN reservations r ON r.schedule_id = s.id
      AND r.status IN ('confirmee', 'utilisee')
    WHERE b.company_id = v_company_id
    GROUP BY b.id, b.registration_number, b.model
  )
  SELECT
    base.bus_id,
    base.registration_number,
    base.model,
    base.trip_count,
    base.revenue,
    base.cc_carburant,
    base.cc_ration,
    base.cc_peage,
    base.fuel_enlev,
    base.expense_reparation,
    base.vehicle_exp,
    base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage
     + base.fuel_enlev + base.expense_reparation + base.vehicle_exp
     + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
     - base.fuel_enlev - base.expense_reparation - base.vehicle_exp
     - base.fuel_carburant_comptable) AS margin
  FROM base;
END;
$function$;
