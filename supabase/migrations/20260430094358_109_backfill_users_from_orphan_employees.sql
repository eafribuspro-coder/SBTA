/*
  # Backfill users table for orphan employees

  Some employees were created with an auth_user_id but no corresponding
  entry in the users table (created before the admin-create-account fix).
  This migration inserts the missing rows into users so that fetchProfile
  works correctly on login.

  1. Affected employees
     - Any employee with auth_user_id set but no matching row in users
  2. Action
     - INSERT INTO users for each missing employee using their employee data
*/

INSERT INTO public.users (
  id, email, full_name, first_name, last_name, phone, role,
  company_id, station_id, employee_id, gender,
  hire_date, contract_type, salary, daily_rate,
  cnps_number, children_count, marital_status,
  bus_id, license_number, license_expiry, license_category,
  assigned_route_id, avatar_url,
  status, is_active, is_self_registered, created_by
)
SELECT
  e.auth_user_id        AS id,
  COALESCE(e.professional_email, e.personal_email, '') AS email,
  TRIM(COALESCE(e.first_name,'') || ' ' || COALESCE(e.last_name,'')) AS full_name,
  e.first_name,
  e.last_name,
  e.phone,
  e.role,
  e.company_id,
  e.station_id,
  e.employee_id,
  e.gender,
  e.hire_date,
  e.contract_type,
  e.salary,
  e.daily_rate,
  e.cnps_number,
  COALESCE(e.children_count, 0),
  e.marital_status,
  e.bus_id,
  e.license_number,
  e.license_expiry,
  e.license_category,
  e.assigned_route_id,
  e.avatar_url,
  CASE WHEN e.account_status = 'active' THEN 'active' ELSE e.account_status END AS status,
  (e.account_status = 'active') AS is_active,
  false AS is_self_registered,
  e.account_created_by  AS created_by
FROM public.employees e
LEFT JOIN public.users u ON u.id = e.auth_user_id
WHERE e.auth_user_id IS NOT NULL
  AND u.id IS NULL;
