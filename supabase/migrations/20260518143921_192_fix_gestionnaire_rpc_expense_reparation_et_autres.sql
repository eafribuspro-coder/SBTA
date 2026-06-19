/*
  # Fix Gestionnaire RPC: expense_reparation et expense_autres

  ## Problème
  - get_gestionnaire_dashboard_kpis : expense_reparation inclut toutes les dépenses
    source='comptable' sans exclure les sorties stock. expense_autres est hardcodé à 0.
  - get_gestionnaire_revenue_by_bus : même problème + pas de colonne expense_autres,
    total_expense et margin ne l'incluent pas.

  ## Correction
  1. expense_reparation = vehicle_expenses WHERE source='comptable'
     AND description NOT LIKE 'Sortie stock — %'  (Autres dépenses comptable)
  2. expense_autres = vehicle_expenses WHERE source='comptable'
     AND description LIKE 'Sortie stock — %'  (Articles depuis le stock)
  3. get_gestionnaire_revenue_by_bus : ajout colonne expense_autres,
     total_expense et margin mis à jour.

  ## Tables
  - vehicle_expenses, fleet_vehicles, comptable_fuel_withdrawals
*/

-- Drop puis recrée avec la nouvelle signature (ajout colonne expense_autres)
DROP FUNCTION IF EXISTS public.get_gestionnaire_revenue_by_bus(date, date);

-- ============================================================
-- 1. Fix get_gestionnaire_dashboard_kpis
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gestionnaire_dashboard_kpis(
  p_date_from date,
  p_date_to   date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_result     jsonb;
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

    -- Autres dépenses comptable hors sorties stock
    'expense_reparation', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'vehicle_expenses_amount', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0),

    'fuel_carburant_comptable', COALESCE((
      SELECT SUM(cfw.total_amount)
      FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = v_company_id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0),

    -- Articles depuis le stock (sorties stock comptable)
    'expense_autres', COALESCE((
      SELECT SUM(ve.amount)
      FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = v_company_id
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
$$;

-- ============================================================
-- 2. Recrée get_gestionnaire_revenue_by_bus avec expense_autres
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_gestionnaire_revenue_by_bus(
  p_date_from date,
  p_date_to   date
)
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
  expense_autres           numeric,
  vehicle_exp              numeric,
  fuel_carburant_comptable numeric,
  total_expense            numeric,
  margin                   numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      -- Autres dépenses comptable hors sorties stock
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_reparation,
      -- Articles depuis le stock
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
          AND ve.source = 'comptable'
          AND ve.description LIKE 'Sortie stock — %'
          AND ve.expense_date BETWEEN p_date_from AND p_date_to
      ), 0) AS expense_autres,
      COALESCE((
        SELECT SUM(ve.amount)
        FROM vehicle_expenses ve
        LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
        LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
          AND ve.vehicle_id IS NULL
        WHERE COALESCE(fv_d.registration_number, fv_r.registration_number) = b.registration_number
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
    base.expense_autres,
    base.vehicle_exp,
    base.fuel_carburant_comptable,
    (base.cc_carburant + base.cc_ration + base.cc_peage
     + base.fuel_enlev + base.expense_reparation + base.expense_autres
     + base.vehicle_exp + base.fuel_carburant_comptable) AS total_expense,
    (base.revenue - base.cc_carburant - base.cc_ration - base.cc_peage
     - base.fuel_enlev - base.expense_reparation - base.expense_autres
     - base.vehicle_exp - base.fuel_carburant_comptable) AS margin
  FROM base;
END;
$$;

-- Rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
