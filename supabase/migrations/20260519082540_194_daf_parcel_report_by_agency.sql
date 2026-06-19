/*
  # DAF Parcel Report — Rapport colis par agence

  ## Overview
  Creates an RPC function for the DAF to view a consolidated parcel report
  grouped by agency (origin station), with counts by status and revenue.

  ## New Function
  get_daf_parcel_report_by_agency(p_date_from, p_date_to, p_station_ids, p_statuses)
    — Returns one row per station with colis counts and CA for the period.

  ## Status values used in parcels table
  - enregistre     : registered
  - mis_en_paquet  : packaged
  - expedie        : shipped
  - arrive         : arrived at destination
  - livre          : delivered
  - retourne       : returned
  - perdu          : lost

  ## Security
  - SECURITY DEFINER, restricted to daf role via is_daf_user()
  - Read-only — no modifications
*/

CREATE OR REPLACE FUNCTION public.get_daf_parcel_report_by_agency(
  p_date_from   date       DEFAULT NULL,
  p_date_to     date       DEFAULT NULL,
  p_station_ids uuid[]     DEFAULT NULL,
  p_statuses    text[]     DEFAULT NULL
)
RETURNS TABLE(
  station_id          uuid,
  station_name        text,
  total_registered    bigint,
  total_mis_en_paquet bigint,
  total_expedie       bigint,
  total_arrive        bigint,
  total_livre         bigint,
  total_retourne      bigint,
  total_perdu         bigint,
  ca_periode          numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_daf_user() THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    s.id                                                      AS station_id,
    s.name                                                    AS station_name,
    COUNT(*) FILTER (
      WHERE p.status = 'enregistre'
    )::bigint                                                 AS total_registered,
    COUNT(*) FILTER (
      WHERE p.status = 'mis_en_paquet'
    )::bigint                                                 AS total_mis_en_paquet,
    COUNT(*) FILTER (
      WHERE p.status = 'expedie'
    )::bigint                                                 AS total_expedie,
    COUNT(*) FILTER (
      WHERE p.status IN ('arrive', 'livre')
    )::bigint                                                 AS total_arrive,
    COUNT(*) FILTER (
      WHERE p.status = 'livre'
    )::bigint                                                 AS total_livre,
    COUNT(*) FILTER (
      WHERE p.status = 'retourne'
    )::bigint                                                 AS total_retourne,
    COUNT(*) FILTER (
      WHERE p.status = 'perdu'
    )::bigint                                                 AS total_perdu,
    COALESCE(SUM(p.total_amount), 0)                         AS ca_periode
  FROM stations s
  LEFT JOIN parcels p
    ON  p.origin_station_id = s.id
    AND (p_date_from IS NULL OR p.registered_at::date >= p_date_from)
    AND (p_date_to   IS NULL OR p.registered_at::date <= p_date_to)
    AND (p_statuses  IS NULL OR p.status = ANY(p_statuses))
  WHERE s.is_active = true
    AND (p_station_ids IS NULL OR s.id = ANY(p_station_ids))
  GROUP BY s.id, s.name
  HAVING COUNT(p.id) > 0
  ORDER BY s.name;
END;
$$;

-- Rechargement du cache PostgREST
NOTIFY pgrst, 'reload schema';
