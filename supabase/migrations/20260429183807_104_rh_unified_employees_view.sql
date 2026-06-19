/*
  # Vue unifiée employees_rh_view

  ## Description
  Combine les données de la table `employees` (nouveau workflow RH)
  et de la table `users` (anciens comptes existants) pour alimenter
  le module RH sans perte de données historiques.

  ## Logique
  - La table `employees` contient les employés créés par le nouveau workflow RH
  - La table `users` contient les comptes créés par l'ancien workflow (admin direct)
  - La vue unifie les deux en évitant les doublons via auth_user_id
  - Les employés dans `employees` qui ont un auth_user_id sont liés à users
  - Les users sans correspondance dans employees sont inclus directement

  ## Colonnes communes exposées
  Toutes les colonnes RH nécessaires aux pages du module RH
*/

CREATE OR REPLACE VIEW public.employees_rh_view AS

-- 1. Employés créés via le nouveau workflow RH (table employees)
SELECT
  e.id,
  e.auth_user_id,
  e.first_name,
  e.last_name,
  COALESCE(e.professional_email, e.personal_email)  AS email,
  e.professional_email,
  e.personal_email,
  e.phone,
  e.gender,
  e.role,
  e.employee_id,
  e.avatar_url,
  e.company_id,
  e.station_id,
  e.hire_date,
  e.salary,
  e.contract_type,
  e.cnps_number,
  e.children_count,
  e.marital_status,
  e.contract_url,
  e.bus_id,
  e.license_number,
  e.license_expiry,
  e.license_category,
  e.driver_average_rating,
  e.driver_performance_level,
  e.driver_total_reviews,
  e.daily_rate,
  e.days_worked_this_month,
  e.current_month_earnings,
  e.seniority_eligibility_date,
  e.seniority_status,
  e.assigned_route_id,
  e.account_status,
  e.deactivated_at,
  e.deactivation_reason,
  e.created_at,
  e.updated_at,
  -- Statut normalisé pour la vue RH
  CASE
    WHEN e.account_status = 'active'    THEN 'active'
    WHEN e.account_status = 'suspended' THEN 'suspended'
    WHEN e.account_status = 'inactive'  THEN 'inactive'
    ELSE 'pending'
  END AS status,
  'employees' AS source_table
FROM public.employees e
WHERE e.role != 'client'

UNION ALL

-- 2. Utilisateurs anciens (table users) sans fiche dans employees
SELECT
  u.id,
  u.id                      AS auth_user_id,
  u.first_name,
  u.last_name,
  u.email,
  NULL::varchar(255)        AS professional_email,
  NULL::varchar(255)        AS personal_email,
  u.phone,
  u.gender,
  u.role,
  u.employee_id,
  u.avatar_url,
  u.company_id,
  u.station_id,
  u.hire_date,
  u.salary,
  u.contract_type,
  u.cnps_number,
  u.children_count,
  u.marital_status,
  u.contract_url,
  u.bus_id,
  u.license_number,
  u.license_expiry,
  u.license_category,
  u.driver_average_rating,
  u.driver_performance_level,
  u.driver_total_reviews,
  u.daily_rate,
  u.days_worked_this_month,
  u.current_month_earnings,
  u.seniority_eligibility_date,
  u.seniority_status,
  u.assigned_route_id,
  COALESCE(u.account_status, 'active') AS account_status,
  u.deactivated_at,
  u.deactivation_reason,
  u.created_at,
  u.updated_at,
  COALESCE(u.status, CASE WHEN u.is_active THEN 'active' ELSE 'inactive' END) AS status,
  'users'     AS source_table
FROM public.users u
WHERE u.role != 'client'
  -- Exclure les users qui ont déjà une fiche employees (éviter les doublons)
  AND NOT EXISTS (
    SELECT 1 FROM public.employees e WHERE e.auth_user_id = u.id
  );
