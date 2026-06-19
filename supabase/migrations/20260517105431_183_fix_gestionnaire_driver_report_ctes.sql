/*
  # Fix: get_gestionnaire_driver_report — CTEs propres, doublons et avg_rating

  ## Problèmes corrigés

  ### 1. Sous-requêtes corrélées counter_charges
  Les sous-requêtes dans le GROUP BY référençaient u.id sans restriction company_id
  ce qui pouvait inclure des charges d'autres compagnies. Remplacé par des CTEs
  pre-agrégés liés aux schedules de la compagnie.

  ### 2. Doublon via LEFT JOIN driver_reviews
  Le LEFT JOIN driver_reviews sur u.id multipliait les lignes de reservations
  dans l'agrégation SUM(r.total_price), causant un sur-comptage des recettes.
  Séparé dans un CTE distinct.

  ### 3. avg_rating = 0 vs NULL
  Quand aucune review n'existe sur la période, on retourne NULL (pas 0)
  pour que le frontend puisse afficher "N/A" plutôt que "0.0 / 5".

  ## Structure finale
  - sched_co  : schedules filtrés par company + période
  - rev_agg   : recettes par schedule_id
  - chg_agg   : charges guichet par driver (via schedule → driver_id)
  - rating_agg: note moyenne par driver sur la période
  - base       : jointure propre sans doublon
*/
CREATE OR REPLACE FUNCTION public.get_gestionnaire_driver_report(p_date_from date, p_date_to date)
RETURNS TABLE(
  driver_id        uuid,
  first_name       text,
  last_name        text,
  employee_id      text,
  bus_registration text,
  trip_count       bigint,
  revenue          numeric,
  cc_carburant     numeric,
  cc_ration        numeric,
  cc_peage         numeric,
  expense_total    numeric,
  avg_rating       numeric
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
  WITH sched_co AS (
    -- Trajets de la compagnie sur la période
    SELECT s.id AS sid, s.driver_id, b.registration_number
    FROM schedules s
    JOIN buses b ON b.id = s.bus_id AND b.company_id = v_company_id
    WHERE s.departure_datetime::date BETWEEN p_date_from AND p_date_to
      AND s.driver_id IS NOT NULL
  ),
  rev_agg AS (
    -- Recettes par schedule
    SELECT r.schedule_id, COALESCE(SUM(r.total_price), 0) AS total
    FROM reservations r
    JOIN sched_co sc ON sc.sid = r.schedule_id
    WHERE r.status IN ('confirmee', 'utilisee')
    GROUP BY r.schedule_id
  ),
  chg_agg AS (
    -- Charges guichet par chauffeur (via schedule → driver_id de la compagnie)
    SELECT
      sc.driver_id,
      SUM(CASE WHEN cc.charge_type = 'carburant_complement' THEN cc.amount ELSE 0 END) AS carb,
      SUM(CASE WHEN cc.charge_type = 'ration'               THEN cc.amount ELSE 0 END) AS ration,
      SUM(CASE WHEN cc.charge_type = 'peage'                THEN cc.amount ELSE 0 END) AS peage
    FROM counter_charges cc
    JOIN sched_co sc ON sc.sid = cc.schedule_id
    WHERE cc.charge_date BETWEEN p_date_from AND p_date_to
    GROUP BY sc.driver_id
  ),
  rating_agg AS (
    -- Moyenne des avis sur la période (NULL si aucun avis)
    SELECT dr.driver_id, AVG(dr.rating::numeric) AS avg_r
    FROM driver_reviews dr
    WHERE dr.created_at::date BETWEEN p_date_from AND p_date_to
    GROUP BY dr.driver_id
  ),
  base AS (
    SELECT
      sc.driver_id,
      COUNT(DISTINCT sc.sid)::bigint           AS trip_count,
      COALESCE(SUM(ra.total), 0)               AS revenue,
      MAX(sc.registration_number)              AS bus_reg
    FROM sched_co sc
    LEFT JOIN rev_agg ra ON ra.schedule_id = sc.sid
    GROUP BY sc.driver_id
  )
  SELECT
    u.id                                   AS driver_id,
    u.first_name,
    u.last_name,
    u.employee_id,
    b.bus_reg                              AS bus_registration,
    b.trip_count,
    b.revenue,
    COALESCE(c.carb,   0)                  AS cc_carburant,
    COALESCE(c.ration, 0)                  AS cc_ration,
    COALESCE(c.peage,  0)                  AS cc_peage,
    COALESCE(c.carb,0) + COALESCE(c.ration,0) + COALESCE(c.peage,0) AS expense_total,
    rt.avg_r                               AS avg_rating
  FROM base b
  JOIN users u ON u.id = b.driver_id
  LEFT JOIN chg_agg    c  ON c.driver_id  = b.driver_id
  LEFT JOIN rating_agg rt ON rt.driver_id = b.driver_id
  ORDER BY b.revenue DESC;
END;
$function$;
