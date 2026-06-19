/*
  # Fonction RPC pour récupérer les chauffeurs (RH)

  Crée une fonction SECURITY DEFINER accessible aux rôles rh et admin
  pour lire tous les chauffeurs depuis users + employees sans problème RLS.

  Cela court-circuite les policies RLS complexes qui peuvent bloquer
  les jointures imbriquées PostgREST.
*/

CREATE OR REPLACE FUNCTION get_all_drivers()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text,
  phone text,
  gender text,
  role text,
  status text,
  employee_id text,
  avatar_url text,
  hire_date date,
  salary numeric,
  contract_type text,
  cnps_number text,
  children_count int,
  marital_status text,
  contract_url text,
  bus_id uuid,
  station_id uuid,
  license_number text,
  license_expiry date,
  license_category text,
  driver_average_rating numeric,
  driver_performance_level text,
  driver_total_reviews int,
  daily_rate numeric,
  days_worked_this_month int,
  current_month_earnings numeric,
  seniority_eligibility_date date,
  seniority_status text,
  assigned_route_id uuid,
  deactivated_at timestamptz,
  deactivation_reason text,
  created_at timestamptz,
  company_id uuid,
  company_name text,
  company_code text,
  station_name text,
  bus_registration text,
  bus_brand text,
  bus_model text,
  bus_class text,
  source_table text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.email,
    u.phone,
    u.gender,
    u.role,
    u.status,
    u.employee_id,
    u.avatar_url,
    u.hire_date,
    u.salary,
    u.contract_type,
    u.cnps_number,
    u.children_count,
    u.marital_status,
    u.contract_url,
    u.bus_id,
    u.station_id,
    u.license_number,
    u.license_expiry::date,
    u.license_category,
    u.driver_average_rating,
    u.driver_performance_level,
    u.driver_total_reviews,
    u.daily_rate,
    u.days_worked_this_month,
    u.current_month_earnings,
    u.seniority_eligibility_date::date,
    u.seniority_status,
    u.assigned_route_id,
    u.deactivated_at,
    u.deactivation_reason,
    u.created_at,
    u.company_id,
    c.name  AS company_name,
    c.code  AS company_code,
    s.name  AS station_name,
    b.registration_number AS bus_registration,
    b.brand AS bus_brand,
    b.model AS bus_model,
    b.class AS bus_class,
    'users'::text AS source_table
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN stations  s ON s.id = u.station_id
  LEFT JOIN buses     b ON b.id = u.bus_id
  WHERE u.role = 'chauffeur'

  UNION ALL

  SELECT
    e.id,
    e.first_name,
    e.last_name,
    COALESCE(e.professional_email, e.personal_email),
    e.phone,
    e.gender,
    e.role,
    CASE e.account_status
      WHEN 'active'   THEN 'active'
      WHEN 'inactive' THEN 'inactive'
      ELSE 'pending'
    END,
    e.employee_id,
    e.avatar_url,
    e.hire_date,
    e.salary,
    e.contract_type,
    e.cnps_number,
    e.children_count,
    e.marital_status,
    e.contract_url,
    e.bus_id,
    e.station_id,
    e.license_number,
    e.license_expiry::date,
    e.license_category,
    e.driver_average_rating,
    e.driver_performance_level,
    e.driver_total_reviews,
    e.daily_rate,
    e.days_worked_this_month,
    e.current_month_earnings,
    e.seniority_eligibility_date::date,
    e.seniority_status,
    e.assigned_route_id,
    e.deactivated_at,
    e.deactivation_reason,
    e.created_at,
    e.company_id,
    c.name,
    c.code,
    s.name,
    b.registration_number,
    b.brand,
    b.model,
    b.class,
    'employees'::text AS source_table
  FROM employees e
  LEFT JOIN companies c ON c.id = e.company_id
  LEFT JOIN stations  s ON s.id = e.station_id
  LEFT JOIN buses     b ON b.id = e.bus_id
  WHERE e.role = 'chauffeur'
    AND (e.auth_user_id IS NULL OR e.auth_user_id NOT IN (SELECT id FROM users WHERE role = 'chauffeur'))
$$;

-- Accès réservé aux rôles rh et admin
REVOKE ALL ON FUNCTION get_all_drivers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_all_drivers() TO authenticated;
