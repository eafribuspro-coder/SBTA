/*
  Fix "column reference company_id is ambiguous" in get_daf_kpis_by_company.

  The function declares `company_id` as an OUT column in RETURNS TABLE. Inside,
  the scr/scc CTEs filter `WHERE company_id = ANY(p_company_ids)` against
  schedule_company_revenue()/schedule_company_charges(), which also expose a
  `company_id` column. Postgres cannot tell the OUT variable from the source
  column, so the query errors and the DAF reports show zeros. Aliasing the
  source functions resolves the ambiguity.
*/

CREATE OR REPLACE FUNCTION get_daf_kpis_by_company(p_company_ids uuid[], p_date_from date, p_date_to date)
RETURNS TABLE(
  company_id uuid, company_name text, company_code text, parent_id uuid, is_group boolean,
  revenue numeric, cc_carburant numeric, cc_ration numeric, cc_peage numeric,
  fuel_enlev numeric, expense_reparation numeric, expense_autres numeric,
  vehicle_exp numeric, fuel_carburant_comptable numeric,
  total_expense numeric, margin numeric,
  trip_count bigint, bus_count bigint, driver_count bigint,
  breakdown_received numeric, breakdown_transferred numeric
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  WITH scr AS (
    SELECT * FROM schedule_company_revenue(p_date_from, p_date_to) v
    WHERE v.company_id = ANY(p_company_ids)
  ),
  scc AS (
    SELECT * FROM schedule_company_charges(p_date_from, p_date_to) v
    WHERE v.company_id = ANY(p_company_ids)
  ),
  agg AS (
    SELECT scr.company_id,
      COALESCE(SUM(scr.revenue), 0)            AS revenue,
      COUNT(DISTINCT scr.schedule_id)::bigint  AS trip_count,
      COUNT(DISTINCT scr.bus_id)::bigint       AS bus_count,
      COUNT(DISTINCT scr.driver_id)
        FILTER (WHERE scr.driver_id IS NOT NULL)::bigint AS driver_count,
      COALESCE(SUM(CASE WHEN scr.is_beneficiary THEN scr.revenue ELSE 0 END), 0) AS breakdown_received,
      COALESCE(SUM(CASE WHEN NOT scr.is_beneficiary THEN scr.transferred_amount ELSE 0 END), 0) AS breakdown_transferred
    FROM scr
    GROUP BY scr.company_id
  ),
  cc_agg AS (
    SELECT scc.company_id,
      COALESCE(SUM(scc.cc_carburant), 0) AS cc_carburant,
      COALESCE(SUM(scc.cc_ration), 0)    AS cc_ration,
      COALESCE(SUM(scc.cc_peage), 0)     AS cc_peage
    FROM scc
    GROUP BY scc.company_id
  )
  SELECT
    co.id, co.name, co.code, co.parent_id, COALESCE(co.is_group, false),
    COALESCE(agg.revenue, 0) AS revenue,
    COALESCE(cca.cc_carburant, 0) AS cc_carburant,
    COALESCE(cca.cc_ration, 0)    AS cc_ration,
    COALESCE(cca.cc_peage, 0)     AS cc_peage,
    COALESCE((
      SELECT SUM(fe.total_amount) FROM fuel_enlevements fe
      WHERE fe.company_id = co.id
        AND fe.enlevement_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_enlev,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'comptable'
        AND (ve.description IS NULL OR ve.description NOT LIKE 'Sortie stock — %')
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS expense_reparation,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'comptable'
        AND ve.description LIKE 'Sortie stock — %'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS expense_autres,
    COALESCE((
      SELECT SUM(ve.amount) FROM vehicle_expenses ve
      LEFT JOIN fleet_vehicles fv_d ON fv_d.id = ve.vehicle_id
      LEFT JOIN fleet_vehicles fv_r ON fv_r.registration_number = ve.registration_number
        AND ve.vehicle_id IS NULL
      WHERE COALESCE(fv_d.company_id, fv_r.company_id) = co.id
        AND ve.source = 'charge_achat'
        AND ve.expense_date BETWEEN p_date_from AND p_date_to
    ), 0) AS vehicle_exp,
    COALESCE((
      SELECT SUM(cfw.total_amount) FROM comptable_fuel_withdrawals cfw
      WHERE cfw.company_id = co.id
        AND cfw.withdrawal_date BETWEEN p_date_from AND p_date_to
    ), 0) AS fuel_carburant_comptable,
    0::numeric AS total_expense,
    0::numeric AS margin,
    COALESCE(agg.trip_count, 0)::bigint,
    COALESCE(agg.bus_count, 0)::bigint,
    COALESCE(agg.driver_count, 0)::bigint,
    COALESCE(agg.breakdown_received, 0),
    COALESCE(agg.breakdown_transferred, 0)
  FROM companies co
  LEFT JOIN agg ON agg.company_id = co.id
  LEFT JOIN cc_agg cca ON cca.company_id = co.id
  WHERE co.id = ANY(p_company_ids)
    AND COALESCE(co.is_active, true) = true
  ORDER BY co.name;
END;
$$;

NOTIFY pgrst, 'reload schema';
