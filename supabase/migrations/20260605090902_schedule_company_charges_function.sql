/*
  Creates schedule_company_charges() — a companion to schedule_company_revenue()
  that distributes counter_charges between origin and beneficiary companies
  when a breakdown charge split has been recorded.

  For schedules with no inter-company breakdown split, all charges go to the bus owner.
  For schedules with a charge distribution, two rows are returned:
    - origin company: gets charges_*_original amounts
    - beneficiary company: gets charges_*_beneficiary amounts
*/

CREATE OR REPLACE FUNCTION public.schedule_company_charges(
  p_from date, p_to date
)
RETURNS TABLE (
  schedule_id        uuid,
  bus_id             uuid,
  company_id         uuid,
  is_beneficiary     boolean,
  cc_ration          numeric,
  cc_carburant       numeric,
  cc_peage           numeric,
  cc_autres          numeric,
  cc_total           numeric
)
LANGUAGE sql STABLE
SET search_path = public
AS $fn$
WITH cc AS (
  SELECT
    cc2.schedule_id,
    cc2.bus_id,
    COALESCE(SUM(cc2.amount) FILTER (WHERE cc2.charge_type = 'ration'), 0)                AS ration,
    COALESCE(SUM(cc2.amount) FILTER (WHERE cc2.charge_type = 'carburant_complement'), 0)  AS carburant,
    COALESCE(SUM(cc2.amount) FILTER (WHERE cc2.charge_type = 'peage'), 0)                 AS peage,
    COALESCE(SUM(cc2.amount) FILTER (WHERE cc2.charge_type NOT IN ('ration','carburant_complement','peage')), 0) AS autres
  FROM counter_charges cc2
  JOIN schedules s ON s.id = cc2.schedule_id
  WHERE cc2.status <> 'rejete'
    AND s.departure_datetime::date BETWEEN p_from AND p_to
  GROUP BY cc2.schedule_id, cc2.bus_id
),
br AS (
  SELECT DISTINCT ON (sb.schedule_id)
    sb.schedule_id,
    sb.status                              AS b_status,
    sb.original_company_id,
    sb.beneficiary_company_id,
    sb.original_bus_id,
    sb.replacement_bus_id,
    COALESCE(sb.charges_ration_original, 0)    AS cr_orig,
    COALESCE(sb.charges_ration_beneficiary, 0) AS cr_benef,
    COALESCE(sb.charges_carburant_original, 0)    AS cc_orig,
    COALESCE(sb.charges_carburant_beneficiary, 0) AS cc_benef,
    COALESCE(sb.charges_peage_original, 0)    AS cp_orig,
    COALESCE(sb.charges_peage_beneficiary, 0) AS cp_benef,
    COALESCE(sb.charges_autres_original, 0)    AS ca_orig,
    COALESCE(sb.charges_autres_beneficiary, 0) AS ca_benef,
    COALESCE(sb.charges_total_beneficiary, 0)  AS total_benef
  FROM schedule_breakdowns sb
  ORDER BY sb.schedule_id, sb.breakdown_at DESC
)
-- Origin row: full charges or origin share
SELECT
  cc.schedule_id,
  cc.bus_id,
  COALESCE(br.original_company_id, b.company_id) AS company_id,
  false AS is_beneficiary,
  CASE WHEN br.b_status = 'cloture' AND br.total_benef > 0
       THEN br.cr_orig ELSE cc.ration END         AS cc_ration,
  CASE WHEN br.b_status = 'cloture' AND br.total_benef > 0
       THEN br.cc_orig ELSE cc.carburant END       AS cc_carburant,
  CASE WHEN br.b_status = 'cloture' AND br.total_benef > 0
       THEN br.cp_orig ELSE cc.peage END           AS cc_peage,
  CASE WHEN br.b_status = 'cloture' AND br.total_benef > 0
       THEN br.ca_orig ELSE cc.autres END          AS cc_autres,
  CASE WHEN br.b_status = 'cloture' AND br.total_benef > 0
       THEN br.cr_orig + br.cc_orig + br.cp_orig + br.ca_orig
       ELSE cc.ration + cc.carburant + cc.peage + cc.autres END AS cc_total
FROM cc
JOIN buses b ON b.id = cc.bus_id
LEFT JOIN br ON br.schedule_id = cc.schedule_id

UNION ALL

-- Beneficiary row: only when charge distribution exists
SELECT
  cc.schedule_id,
  COALESCE(br.replacement_bus_id, cc.bus_id) AS bus_id,
  br.beneficiary_company_id                  AS company_id,
  true                                       AS is_beneficiary,
  br.cr_benef                                AS cc_ration,
  br.cc_benef                                AS cc_carburant,
  br.cp_benef                                AS cc_peage,
  br.ca_benef                                AS cc_autres,
  br.cr_benef + br.cc_benef + br.cp_benef + br.ca_benef AS cc_total
FROM cc
JOIN br ON br.schedule_id = cc.schedule_id
WHERE br.b_status = 'cloture'
  AND br.beneficiary_company_id IS NOT NULL
  AND br.beneficiary_company_id <> br.original_company_id
  AND br.total_benef > 0;
$fn$;
