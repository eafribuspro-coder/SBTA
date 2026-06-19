/*
  # Module RH — Vues masse salariale v2 (salariés + contractuels)

  ## Résumé
  Remplace la vue payroll_by_company par une version enrichie intégrant
  la double catégorie salariés (fixe) + contractuels (variable mensuel).
  Ajoute la vue contractual_monthly_summary pour le détail mensuel par chauffeur.

  ## Vue payroll_by_company (remplacée)
  Champs ajoutés :
  - masse_salariale_totale  : fixe + variable du mois courant
  - masse_salariale_fixe    : salaires mensuels des titulaires
  - masse_salariale_variable: rémunérations variables des contractuels (mois courant)
  - salaire_moyen_titulaire : salaire moyen des titulaires
  - remuneration_moy_contractuel : rémunération moyenne des contractuels ce mois
  - chauffeurs_salaries     : nb chauffeurs titulaires
  - chauffeurs_contractuels : nb chauffeurs contractuels
  - eligibles_passage_salarial : contractuels éligibles au passage salarié
  - Conserve les champs masse_salariale, salaire_moyen, salaire_min, salaire_max
    (alias pour compatibilité descendante avec le code frontend existant)

  ## Vue contractual_monthly_summary (nouvelle)
  Détail mensuel par chauffeur contractuel :
  - Jours travaillés, taux moyen, total gagné
  - Décomposition payé / en attente
  - Détail JSON par journée (date, route, taux, prix billet, statut paiement)

  ## Notes
  - Les deux vues sont en lecture seule (pas de RLS nécessaire sur les vues,
    la sécurité est portée par les tables sous-jacentes)
  - Compatibilité : les colonnes masse_salariale, salaire_moyen, salaire_min, salaire_max
    sont conservées comme alias pour ne pas casser le frontend actuel
*/

-- ──────────────────────────────────────────────────────────────────
-- 1.7 Remplacer payroll_by_company
-- ──────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS payroll_by_company;

CREATE OR REPLACE VIEW payroll_by_company AS
WITH
  fixed_salaries AS (
    SELECT
      u.company_id,
      u.role,
      u.contract_type,
      COALESCE(u.salary, 0)                 AS monthly_cost,
      'fixed'                               AS cost_type
    FROM users u
    WHERE u.contract_type = 'titulaire'
      AND u.role != 'client'
      AND u.status = 'active'
      AND u.company_id IS NOT NULL
  ),
  variable_earnings AS (
    SELECT
      u.company_id,
      u.role,
      u.contract_type,
      COALESCE(u.current_month_earnings, 0) AS monthly_cost,
      'variable'                            AS cost_type
    FROM users u
    WHERE u.contract_type = 'contractuel'
      AND u.role != 'client'
      AND u.status = 'active'
      AND u.company_id IS NOT NULL
  ),
  all_costs AS (
    SELECT * FROM fixed_salaries
    UNION ALL
    SELECT * FROM variable_earnings
  )
SELECT
  c.id                                                              AS company_id,
  c.name                                                            AS company_name,
  c.code                                                            AS company_code,

  -- Effectifs
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.status = 'active' AND u.role != 'client')              AS total_employees,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.contract_type = 'titulaire' AND u.status = 'active')   AS titulaires,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.contract_type = 'contractuel' AND u.status = 'active') AS contractuels,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.status = 'active' AND u.role != 'client')              AS employes_actifs,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.status != 'active' AND u.role != 'client')             AS employes_inactifs,

  -- Chauffeurs
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.role = 'chauffeur' AND u.status = 'active')            AS nb_chauffeurs,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.role = 'chauffeur'
      AND u.contract_type = 'titulaire'
      AND u.status = 'active')                                      AS chauffeurs_salaries,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.role = 'chauffeur'
      AND u.contract_type = 'contractuel'
      AND u.status = 'active')                                      AS chauffeurs_contractuels,

  -- Autres postes
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.role = 'guichetier' AND u.status = 'active')           AS nb_guichetiers,
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.role = 'mecanicien' AND u.status = 'active')           AS nb_mecaniciens,

  -- Masse salariale complète (fixe + variable)
  COALESCE(SUM(ac.monthly_cost), 0)                                AS masse_salariale_totale,
  COALESCE(SUM(ac.monthly_cost) FILTER (
    WHERE ac.cost_type = 'fixed'), 0)                              AS masse_salariale_fixe,
  COALESCE(SUM(ac.monthly_cost) FILTER (
    WHERE ac.cost_type = 'variable'), 0)                           AS masse_salariale_variable,

  -- Aliases compatibilité frontend existant
  COALESCE(SUM(ac.monthly_cost), 0)                                AS masse_salariale,
  CASE
    WHEN COUNT(DISTINCT u.id) FILTER (
      WHERE u.status = 'active' AND u.role != 'client') > 0
    THEN COALESCE(SUM(ac.monthly_cost), 0) /
         NULLIF(COUNT(DISTINCT u.id) FILTER (
           WHERE u.status = 'active' AND u.role != 'client'), 0)
    ELSE 0
  END                                                               AS salaire_moyen,
  COALESCE(MIN(u.salary) FILTER (
    WHERE u.contract_type = 'titulaire' AND u.status = 'active'), 0) AS salaire_min,
  COALESCE(MAX(u.salary) FILTER (
    WHERE u.contract_type = 'titulaire' AND u.status = 'active'), 0) AS salaire_max,

  -- Moyennes par catégorie
  COALESCE(AVG(u.salary) FILTER (
    WHERE u.contract_type = 'titulaire' AND u.status = 'active'), 0) AS salaire_moyen_titulaire,
  COALESCE(AVG(u.current_month_earnings) FILTER (
    WHERE u.contract_type = 'contractuel' AND u.status = 'active'), 0) AS remuneration_moy_contractuel,

  -- Alertes éligibilité passage salarial
  COUNT(DISTINCT u.id) FILTER (
    WHERE u.seniority_status = 'eligible')                         AS eligibles_passage_salarial

FROM companies c
LEFT JOIN users u
  ON u.company_id = c.id
LEFT JOIN all_costs ac
  ON ac.company_id = c.id
GROUP BY c.id, c.name, c.code
ORDER BY masse_salariale_totale DESC;

-- ──────────────────────────────────────────────────────────────────
-- 1.8 Vue mensuelle détaillée des rémunérations contractuelles
-- ──────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS contractual_monthly_summary;

CREATE OR REPLACE VIEW contractual_monthly_summary AS
SELECT
  ddl.driver_id,
  u.first_name || ' ' || u.last_name            AS driver_name,
  u.employee_id,
  c.name                                         AS company_name,
  c.code                                         AS company_code,
  ddl.work_year_month,
  to_char(
    make_date(
      ddl.work_year_month / 100,
      ddl.work_year_month % 100,
      1
    ), 'Month YYYY'
  )                                              AS month_label,
  COUNT(DISTINCT ddl.work_date)                  AS days_worked,
  ROUND(AVG(ddl.daily_rate), 2)                  AS avg_daily_rate,
  SUM(ddl.daily_rate)                            AS total_earned,
  COUNT(*) FILTER (
    WHERE ddl.payment_status = 'paye')           AS days_paid,
  COUNT(*) FILTER (
    WHERE ddl.payment_status = 'du')             AS days_pending,
  SUM(ddl.daily_rate) FILTER (
    WHERE ddl.payment_status = 'paye')           AS amount_paid,
  SUM(ddl.daily_rate) FILTER (
    WHERE ddl.payment_status = 'du')             AS amount_pending,
  jsonb_agg(
    jsonb_build_object(
      'date',       ddl.work_date,
      'route',      ddl.route_name,
      'rate',       ddl.daily_rate,
      'ticket',     ddl.ticket_price,
      'paid',       ddl.payment_status = 'paye',
      'schedule_id',ddl.schedule_id
    ) ORDER BY ddl.work_date
  )                                              AS daily_detail
FROM driver_daily_logs ddl
JOIN users u     ON u.id = ddl.driver_id
JOIN companies c ON c.id = ddl.company_id
WHERE ddl.payment_status != 'annule'
GROUP BY
  ddl.driver_id,
  u.first_name, u.last_name, u.employee_id,
  c.name, c.code,
  ddl.work_year_month
ORDER BY ddl.work_year_month DESC, total_earned DESC;

-- Recharger le cache schéma PostgREST
NOTIFY pgrst, 'reload schema';
