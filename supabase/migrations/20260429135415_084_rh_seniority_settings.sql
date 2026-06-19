/*
  # Module RH — Paramètres d'ancienneté

  ## Résumé
  Crée la table seniority_settings qui centralise le paramètre de seuil
  d'ancienneté (en mois) pour le passage contractuel → salarié.

  ## Nouvelle table seniority_settings
  - seniority_threshold_months : durée minimale (défaut 6 mois)
  - requires_hr_validation : le passage est-il automatique ou validé par RH
  - Ligne unique de paramétrage, modifiable par rh/admin

  ## Données initiales
  - Seuil par défaut : 6 mois, validation RH obligatoire

  ## Sécurité RLS
  - Lecture : rh, admin, gestionnaire, daf
  - Écriture : rh et admin uniquement
*/

CREATE TABLE IF NOT EXISTS seniority_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seniority_threshold_months  int NOT NULL DEFAULT 6,
  requires_hr_validation      boolean DEFAULT true,
  updated_by                  uuid REFERENCES users(id),
  updated_at                  timestamptz DEFAULT now()
);

ALTER TABLE seniority_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_admin_read_seniority_settings"
  ON seniority_settings FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin', 'gestionnaire', 'daf'));

CREATE POLICY "rh_admin_insert_seniority_settings"
  ON seniority_settings FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_update_seniority_settings"
  ON seniority_settings FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'))
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

-- Ligne de paramètres par défaut
INSERT INTO seniority_settings (seniority_threshold_months, requires_hr_validation)
VALUES (6, true)
ON CONFLICT DO NOTHING;
