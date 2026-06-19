/*
  # PARTIE 1.3 — Fonctions helper pour employees

  ## Contexte
  Réécriture des fonctions get_my_role(), get_my_company_id() pour
  chercher d'abord dans employees (nouvelle table), puis fallback sur users.
  Ajout de get_current_employee() et get_my_employee_id().
*/

-- get_my_role() : cherche dans employees d'abord, puis users (fallback)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1),
    (SELECT COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role'
    ))
  );
$$;

-- get_my_company_id() : cherche dans employees d'abord, puis users
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1),
    (SELECT company_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );
$$;

-- get_current_employee() : retourne la fiche employé de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_current_employee()
RETURNS public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- get_my_employee_id() : retourne l'id employees de l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.get_my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
