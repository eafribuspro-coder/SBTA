-- Rebuild payroll_by_company on the unified employees_rh_view so that
-- employees created via the RH workflow (table employees, status 'pending')
-- are counted immediately in masse salariale, headcount and per-company stats.

DROP VIEW IF EXISTS payroll_by_company;

CREATE OR REPLACE VIEW payroll_by_company AS
WITH workforce AS (
  SELECT
    ev.id,
    ev.company_id,
    ev.role,
    ev.contract_type,
    ev.status,
    ev.salary,
    ev.current_month_earnings,
    ev.seniority_status,
    CASE
      WHEN ev.contract_type = 'titulaire'   THEN COALESCE(ev.salary, 0)
      WHEN ev.contract_type = 'contractuel' THEN COALESCE(ev.current_month_earnings, 0)
      ELSE 0
    END                                        AS monthly_cost,
    (ev.status IN ('active', 'pending'))       AS counted
  FROM employees_rh_view ev
  WHERE ev.role != 'client'
    AND ev.company_id IS NOT NULL
)
SELECT
  c.id                                                              AS company_id,
  c.name                                                            AS company_name,
  c.code                                                            AS company_code,

  -- Effectifs (les fiches 'pending' comptent comme effectif courant)
  COUNT(DISTINCT w.id) FILTER (WHERE w.counted)                     AS total_employees,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.contract_type = 'titulaire')              AS titulaires,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.contract_type = 'contractuel')            AS contractuels,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active')           AS employes_actifs,
  COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'inactive')         AS employes_inactifs,

  -- Chauffeurs
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.role = 'chauffeur')                       AS nb_chauffeurs,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.role = 'chauffeur'
      AND w.contract_type = 'titulaire')                            AS chauffeurs_salaries,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.role = 'chauffeur'
      AND w.contract_type = 'contractuel')                          AS chauffeurs_contractuels,

  -- Autres postes
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.role = 'guichetier')                      AS nb_guichetiers,
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.role = 'mecanicien')                      AS nb_mecaniciens,

  -- Masse salariale (fixe + variable)
  COALESCE(SUM(w.monthly_cost) FILTER (WHERE w.counted), 0)         AS masse_salariale_totale,
  COALESCE(SUM(w.monthly_cost) FILTER (
    WHERE w.counted AND w.contract_type = 'titulaire'), 0)          AS masse_salariale_fixe,
  COALESCE(SUM(w.monthly_cost) FILTER (
    WHERE w.counted AND w.contract_type = 'contractuel'), 0)        AS masse_salariale_variable,

  -- Aliases compatibilité frontend existant
  COALESCE(SUM(w.monthly_cost) FILTER (WHERE w.counted), 0)         AS masse_salariale,
  CASE
    WHEN COUNT(DISTINCT w.id) FILTER (WHERE w.counted) > 0
    THEN COALESCE(SUM(w.monthly_cost) FILTER (WHERE w.counted), 0) /
         NULLIF(COUNT(DISTINCT w.id) FILTER (WHERE w.counted), 0)
    ELSE 0
  END                                                               AS salaire_moyen,
  COALESCE(MIN(w.salary) FILTER (
    WHERE w.counted AND w.contract_type = 'titulaire'), 0)          AS salaire_min,
  COALESCE(MAX(w.salary) FILTER (
    WHERE w.counted AND w.contract_type = 'titulaire'), 0)          AS salaire_max,

  -- Moyennes par catégorie
  COALESCE(AVG(w.salary) FILTER (
    WHERE w.counted AND w.contract_type = 'titulaire'), 0)          AS salaire_moyen_titulaire,
  COALESCE(AVG(w.current_month_earnings) FILTER (
    WHERE w.counted AND w.contract_type = 'contractuel'), 0)        AS remuneration_moy_contractuel,

  -- Alertes éligibilité passage salarial
  COUNT(DISTINCT w.id) FILTER (
    WHERE w.counted AND w.seniority_status = 'eligible')            AS eligibles_passage_salarial

FROM companies c
LEFT JOIN workforce w ON w.company_id = c.id
GROUP BY c.id, c.name, c.code
ORDER BY masse_salariale_totale DESC;

NOTIFY pgrst, 'reload schema';
