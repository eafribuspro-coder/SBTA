/*
  # Module RH — Journal des rémunérations contractuelles

  ## Résumé
  Crée la table driver_daily_logs qui enregistre chaque jour travaillé
  d'un chauffeur contractuel pour le calcul de sa rémunération variable.

  ## Nouvelle table driver_daily_logs
  - Un enregistrement par jour travaillé par chauffeur contractuel
  - Snapshot du taux journalier appliqué (résistant aux changements de barème)
  - Snapshot du nom de l'itinéraire et du prix billet
  - Suivi du paiement : du / paye / annule
  - work_year_month (int YYYYMM) : colonne calculée par trigger, permet les index sur mois

  ## Index
  - driver_id, work_date, company_id, work_year_month

  ## Sécurité RLS
  - rh/admin : accès complet
  - gestionnaire/daf/comptable : lecture société
  - chauffeur : lecture de ses propres logs
*/

CREATE TABLE IF NOT EXISTS driver_daily_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id      uuid REFERENCES users(id)      NOT NULL,
  company_id     uuid REFERENCES companies(id)  NOT NULL,
  schedule_id    uuid REFERENCES schedules(id),
  route_id       uuid REFERENCES routes(id),
  work_date      date NOT NULL,
  -- YYYYMM entier pour faciliter les agrégations mensuelles sans date_trunc
  work_year_month int  NOT NULL,
  daily_rate     decimal(10,2) NOT NULL,
  route_name     varchar(255),
  ticket_price   decimal(10,2),
  payment_status text DEFAULT 'du'
    CHECK (payment_status IN ('du', 'paye', 'annule')),
  paid_at        timestamptz,
  paid_by        uuid REFERENCES users(id),
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- Trigger pour alimenter work_year_month automatiquement
CREATE OR REPLACE FUNCTION set_work_year_month()
RETURNS TRIGGER AS $$
BEGIN
  NEW.work_year_month := EXTRACT(YEAR FROM NEW.work_date)::int * 100
                       + EXTRACT(MONTH FROM NEW.work_date)::int;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TRIGGER trg_set_work_year_month
  BEFORE INSERT OR UPDATE ON driver_daily_logs
  FOR EACH ROW EXECUTE FUNCTION set_work_year_month();

CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_driver
  ON driver_daily_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_date
  ON driver_daily_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_company
  ON driver_daily_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_month
  ON driver_daily_logs(work_year_month);
CREATE INDEX IF NOT EXISTS idx_driver_daily_logs_driver_month
  ON driver_daily_logs(driver_id, work_year_month);

-- RLS
ALTER TABLE driver_daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_admin_select_daily_logs"
  ON driver_daily_logs FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_insert_daily_logs"
  ON driver_daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_update_daily_logs"
  ON driver_daily_logs FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'))
  WITH CHECK (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "rh_admin_delete_daily_logs"
  ON driver_daily_logs FOR DELETE
  TO authenticated
  USING (get_my_role() IN ('rh', 'admin'));

CREATE POLICY "gestionnaire_daf_read_company_logs"
  ON driver_daily_logs FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('gestionnaire', 'daf', 'comptable')
    AND company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid())
  );

CREATE POLICY "chauffeur_read_own_logs"
  ON driver_daily_logs FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'chauffeur'
    AND driver_id = auth.uid()
  );
