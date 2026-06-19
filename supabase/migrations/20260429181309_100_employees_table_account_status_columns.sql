/*
  # PARTIE 1.1 — Ajouter colonnes account_status sur users + créer table employees

  ## Contexte
  Séparation des rôles Admin (compte) & RH (employé).
  - RH crée la fiche employé (table employees)
  - Admin crée le compte de connexion (auth.users)
  - La liaison se fait via employees.auth_user_id

  ## Nouvelles colonnes sur users (rétro-compatibilité)
  - account_status : état du compte (pending/active/suspended/inactive)
  - account_created_at : date de création du compte Auth
  - account_created_by : qui a créé le compte
  - auth_user_id : lien vers auth.users (NULL = pas de compte)
  - professional_email : email professionnel

  ## Nouvelle table employees
  Table RH pure, indépendante de auth.users
*/

-- ─── 1.1 Colonnes de statut sur users (rétro-compatibilité) ────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_status
    text CHECK (account_status IN ('pending','active','suspended','inactive'))
    DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS account_created_at
    timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS account_created_by
    uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auth_user_id
    uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS professional_email
    varchar(255) DEFAULT NULL;

-- Mettre à jour les users existants (qui ont déjà un compte) comme 'active'
UPDATE public.users
SET account_status = 'active',
    auth_user_id   = id   -- pour les anciens users, id = auth.users.id
WHERE account_status IS NULL OR account_status = 'active';

-- ─── 1.2 Table employees ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employees (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liaison optionnelle au compte Auth (NULL = pas encore de compte)
  auth_user_id              uuid UNIQUE DEFAULT NULL,

  -- INFORMATIONS PERSONNELLES
  first_name                varchar(100) NOT NULL,
  last_name                 varchar(100) NOT NULL,
  gender                    text CHECK (gender IN ('M','F')),
  phone                     varchar(50),
  personal_email            varchar(255),
  professional_email        varchar(255),

  -- DONNÉES RH
  role                      text NOT NULL CHECK (role IN (
                              'admin','daf','comptable','rh','gestionnaire',
                              'chauffeur','guichetier','chef_garage','mecanicien',
                              'planificateur','pompiste','chef_gare'
                            )),
  employee_id               varchar(50) UNIQUE,
  company_id                uuid REFERENCES public.companies(id),
  station_id                uuid REFERENCES public.stations(id),
  hire_date                 date,
  contract_type             text CHECK (contract_type IN ('titulaire','contractuel')),
  salary                    decimal(15,2),
  daily_rate                decimal(15,2),
  cnps_number               varchar(50),
  children_count            int DEFAULT 0,
  marital_status            text CHECK (marital_status IN (
                              'celibataire','marie','divorce','veuf'
                            )),

  -- CHAUFFEURS
  bus_id                    uuid REFERENCES public.buses(id),
  license_number            varchar(100),
  license_expiry            date,
  license_category          varchar(20),
  daily_drive_hours_limit   decimal(4,2) DEFAULT 9.0,
  weekly_drive_hours_limit  decimal(5,2) DEFAULT 48.0,

  -- DOCUMENTS
  avatar_url                text,
  contract_url              text,

  -- STATUT DU COMPTE DE CONNEXION
  account_status            text CHECK (account_status IN (
                              'pending','active','suspended','inactive'
                            )) DEFAULT 'pending',
  account_created_at        timestamptz,
  account_created_by        uuid,

  -- ANCIENNETÉ & PERFORMANCE
  seniority_status          text CHECK (seniority_status IN (
                              'non_eligible','eligible','converti'
                            )) DEFAULT 'non_eligible',
  seniority_eligibility_date date,
  days_worked_this_month    int DEFAULT 0,
  current_month_earnings    decimal(15,2) DEFAULT 0,
  assigned_route_id         uuid REFERENCES public.routes(id),

  -- Performance chauffeur
  driver_average_rating     decimal(3,2) DEFAULT 0,
  driver_total_points       int DEFAULT 0,
  driver_performance_level  text DEFAULT 'bronze',
  driver_total_reviews      int DEFAULT 0,

  -- AUDIT
  created_by                uuid,
  updated_by                uuid,
  deactivated_at            timestamptz,
  deactivated_by            uuid,
  deactivation_reason       text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id    ON public.employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_company_id      ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_role            ON public.employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_account_status  ON public.employees(account_status);
CREATE INDEX IF NOT EXISTS idx_employees_station_id      ON public.employees(station_id);

-- RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
