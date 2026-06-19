/*
  # PARTIE 1.5 — Vue employees_pending_account

  ## Description
  Vue pour l'admin listant tous les employés créés par le RH
  qui n'ont pas encore de compte de connexion (account_status = 'pending').
  Triée du plus ancien au plus récent pour prioriser les attentes les plus longues.
*/

CREATE OR REPLACE VIEW public.employees_pending_account AS
SELECT
  e.id,
  e.first_name,
  e.last_name,
  e.first_name || ' ' || e.last_name   AS full_name,
  e.role,
  e.professional_email,
  e.personal_email,
  e.phone,
  e.employee_id,
  e.hire_date,
  e.account_status,
  e.created_at                          AS created_by_hr_at,
  e.company_id,
  c.name                                AS company_name,
  c.code                                AS company_code,
  s.name                                AS station_name
FROM public.employees e
LEFT JOIN public.companies c ON c.id = e.company_id
LEFT JOIN public.stations  s ON s.id = e.station_id
WHERE e.account_status = 'pending'
ORDER BY e.created_at ASC;
