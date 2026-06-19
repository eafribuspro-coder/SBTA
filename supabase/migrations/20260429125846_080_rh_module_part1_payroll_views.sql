/*
  # Module RH — Partie 1.5 : Vues SQL masse salariale et détail chauffeurs

  ## Résumé
  Crée deux vues analytiques pour le module RH :
  1. `payroll_by_company` — Agrégation de la masse salariale par société
  2. `drivers_detail`     — Vue enrichie des chauffeurs avec bus, gare et ancienneté

  ## Vues créées

  ### payroll_by_company
  - Totaux par société : nb employés, titulaires, contractuels
  - Masse salariale, salaire moyen / min / max
  - Répartition par rôle (chauffeurs, guichetiers, mécaniciens)
  - Compteurs actifs / inactifs

  ### drivers_detail
  - Données complètes du chauffeur (identité, contrat, performance)
  - Informations société, gare et bus affecté
  - Ancienneté calculée automatiquement (années et texte)
  - Adapté aux colonnes réelles de la table buses (registration_number, class)

  ## Notes
  - Utilise OR REPLACE pour permettre les replays
  - Les colonnes correspondent aux noms réels des tables (vérifiés avant création)
*/

-- Vue masse salariale par société
CREATE OR REPLACE VIEW payroll_by_company AS
SELECT
  c.id                                                          AS company_id,
  c.name                                                        AS company_name,
  c.code                                                        AS company_code,
  COUNT(u.id)                                                   AS total_employees,
  COUNT(CASE WHEN u.contract_type = 'titulaire'   THEN 1 END)  AS titulaires,
  COUNT(CASE WHEN u.contract_type = 'contractuel' THEN 1 END)  AS contractuels,
  COALESCE(SUM(u.salary),  0)                                   AS masse_salariale,
  COALESCE(AVG(u.salary),  0)                                   AS salaire_moyen,
  COALESCE(MIN(u.salary),  0)                                   AS salaire_min,
  COALESCE(MAX(u.salary),  0)                                   AS salaire_max,
  COUNT(CASE WHEN u.role = 'chauffeur'   THEN 1 END)           AS nb_chauffeurs,
  COUNT(CASE WHEN u.role = 'guichetier'  THEN 1 END)           AS nb_guichetiers,
  COUNT(CASE WHEN u.role = 'mecanicien'  THEN 1 END)           AS nb_mecaniciens,
  COUNT(CASE WHEN u.status = 'active'    THEN 1 END)           AS employes_actifs,
  COUNT(CASE WHEN u.status = 'inactive'  THEN 1 END)           AS employes_inactifs
FROM companies c
LEFT JOIN users u
  ON  u.company_id = c.id
  AND u.role       != 'client'
  AND u.status     != 'suspended'
GROUP BY c.id, c.name, c.code
ORDER BY masse_salariale DESC;

-- Vue détaillée des chauffeurs avec bus, gare et ancienneté
CREATE OR REPLACE VIEW drivers_detail AS
SELECT
  u.id,
  u.first_name,
  u.last_name,
  u.first_name || ' ' || u.last_name     AS full_name,
  u.phone,
  u.email,
  u.gender,
  u.employee_id,
  u.contract_type,
  u.hire_date,
  u.salary,
  u.status,
  u.cnps_number,
  u.license_number,
  u.license_expiry,
  u.license_category,
  u.avatar_url,
  -- Société
  c.id                                   AS company_id,
  c.name                                 AS company_name,
  c.code                                 AS company_code,
  -- Gare d'affectation
  s.id                                   AS station_id,
  s.name                                 AS station_name,
  -- Bus affecté (colonnes réelles : registration_number, class)
  b.id                                   AS bus_id,
  b.registration_number                  AS bus_registration,
  b.brand                                AS bus_brand,
  b.model                                AS bus_model,
  b.class                                AS bus_class,
  -- Ancienneté calculée
  CASE
    WHEN u.hire_date IS NOT NULL
    THEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, u.hire_date))::int
    ELSE NULL
  END                                    AS years_of_service,
  CASE
    WHEN u.hire_date IS NOT NULL
    THEN AGE(CURRENT_DATE, u.hire_date)::text
    ELSE NULL
  END                                    AS seniority_text,
  -- Performance conduite
  u.driver_average_rating,
  u.driver_performance_level,
  u.driver_total_reviews
FROM users u
LEFT JOIN companies c ON c.id = u.company_id
LEFT JOIN stations  s ON s.id = u.station_id
LEFT JOIN buses     b ON b.id = u.bus_id
WHERE u.role = 'chauffeur';
