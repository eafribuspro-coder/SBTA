/*
  # Module RH — Rémunération chauffeurs : schéma de base

  ## Résumé
  Enrichit le schéma pour supporter la double catégorie de chauffeurs :
  - Salariés (titulaires) : salaire fixe mensuel
  - Contractuels : rémunération variable à la journée par trajet effectué

  ## Modifications
  ### Table users (colonnes ajoutées)
  - `daily_rate`               — Taux journalier du contractuel (FCFA/jour), null pour les salariés
  - `days_worked_this_month`   — Nb jours travaillés ce mois (calculé par trigger)
  - `current_month_earnings`   — Rémunération estimée du mois courant (calculée par trigger)
  - `seniority_eligibility_date` — Date à laquelle le contractuel devient éligible au passage salarié
  - `seniority_status`         — Statut d'éligibilité : non_eligible / eligible / converti
  - `assigned_route_id`        — Itinéraire habituel du chauffeur (optionnel, FK routes)

  ### Nouvelle table driver_daily_rates
  - Taux journaliers de référence par itinéraire et par société
  - Permet au RH de définir des barèmes selon les trajets
  - La valeur sur users.daily_rate peut s'en écarter (personnalisation individuelle)

  ## Sécurité
  - RLS activé sur driver_daily_rates
  - Lecture : personnel authentifié selon rôle (rh, admin, gestionnaire)
  - Écriture : rh et admin uniquement
*/

-- ──────────────────────────────────────────────────────────────────
-- 1.1 Enrichir la table users
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS daily_rate
    decimal(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS days_worked_this_month
    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_month_earnings
    decimal(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seniority_eligibility_date
    date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seniority_status
    text DEFAULT 'non_eligible',
  ADD COLUMN IF NOT EXISTS assigned_route_id
    uuid DEFAULT NULL;

-- Contrainte CHECK sur seniority_status (ajoutée séparément pour IF NOT EXISTS compatible)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'users' AND constraint_name = 'users_seniority_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_seniority_status_check
      CHECK (seniority_status IN ('non_eligible', 'eligible', 'converti'));
  END IF;
END $$;

-- FK vers routes (ajoutée séparément)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'users' AND constraint_name = 'users_assigned_route_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_assigned_route_id_fkey
      FOREIGN KEY (assigned_route_id) REFERENCES routes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- 1.2 Table driver_daily_rates (taux journaliers par itinéraire)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS driver_daily_rates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id     uuid REFERENCES routes(id)    NOT NULL,
  company_id   uuid REFERENCES companies(id) NOT NULL,
  route_name   varchar(255) NOT NULL,
  ticket_price decimal(10,2) NOT NULL,
  daily_rate   decimal(10,2) NOT NULL,
  is_active    boolean DEFAULT true,
  notes        text,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (route_id, company_id)
);

ALTER TABLE driver_daily_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_admin_manage_daily_rates"
  ON driver_daily_rates FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_update_daily_rates"
  ON driver_daily_rates FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'))
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_delete_daily_rates"
  ON driver_daily_rates FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "operational_read_daily_rates"
  ON driver_daily_rates FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin', 'gestionnaire', 'daf', 'comptable'));
