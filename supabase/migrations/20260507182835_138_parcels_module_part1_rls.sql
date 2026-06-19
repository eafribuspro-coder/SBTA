/*
  # MODULE COLIS — PARTIE 1.5 : RLS pour parcels et parcel_tracking_events

  ## Politiques parcels
  - agent_colis_select    : agent voit les colis de SA gare (départ ou arrivée)
  - agent_colis_insert    : agent crée des colis depuis SA gare de départ
  - agent_colis_update    : agent met à jour les colis de SA gare
  - superviseur_select    : superviseur/admin/daf voit tout
  - superviseur_insert    : superviseur/admin peut créer
  - superviseur_update    : superviseur/admin peut modifier
  - public_tracking       : lecture publique par parcel_code (tracking sans auth)

  ## Politiques parcel_tracking_events
  - tracking_events_select : agent voit les événements des colis de sa gare ; superviseur/admin voit tout
  - tracking_events_insert : agent et superviseur peuvent insérer
*/

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_tracking_events ENABLE ROW LEVEL SECURITY;

-- ── PARCELS ──────────────────────────────────────────────────────────────────

-- Agent colis : SELECT sur SA gare
CREATE POLICY "agent_colis_select_sa_gare"
  ON parcels FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'agent_colis'
    AND (
      origin_station_id      = (SELECT station_id FROM users WHERE id = auth.uid())
      OR destination_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
    )
  );

-- Agent colis : INSERT depuis SA gare de départ
CREATE POLICY "agent_colis_insert_sa_gare"
  ON parcels FOR INSERT
  TO authenticated
  WITH CHECK (
    get_my_role() = 'agent_colis'
    AND origin_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
  );

-- Agent colis : UPDATE sur SA gare
CREATE POLICY "agent_colis_update_sa_gare"
  ON parcels FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'agent_colis'
    AND (
      origin_station_id      = (SELECT station_id FROM users WHERE id = auth.uid())
      OR destination_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    get_my_role() = 'agent_colis'
    AND (
      origin_station_id      = (SELECT station_id FROM users WHERE id = auth.uid())
      OR destination_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
    )
  );

-- Superviseur / admin / daf : SELECT tout
CREATE POLICY "superviseur_colis_select_all"
  ON parcels FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin','daf')
  );

-- Superviseur / admin : INSERT
CREATE POLICY "superviseur_colis_insert"
  ON parcels FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin')
  );

-- Superviseur / admin : UPDATE
CREATE POLICY "superviseur_colis_update"
  ON parcels FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin')
  );

-- Tracking public sans authentification (lecture seule)
CREATE POLICY "public_tracking_read"
  ON parcels FOR SELECT
  TO anon
  USING (true);

-- ── PARCEL_TRACKING_EVENTS ────────────────────────────────────────────────────

-- SELECT : agent voit les événements des colis de sa gare ; superviseur/admin voit tout
CREATE POLICY "tracking_events_select"
  ON parcel_tracking_events FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin','daf')
    OR parcel_id IN (
      SELECT id FROM parcels
      WHERE origin_station_id      = (SELECT station_id FROM users WHERE id = auth.uid())
         OR destination_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
    )
  );

-- INSERT : agent et superviseur peuvent insérer des événements
CREATE POLICY "tracking_events_insert"
  ON parcel_tracking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superviseur_colis','admin','agent_colis')
    OR parcel_id IN (
      SELECT id FROM parcels
      WHERE origin_station_id      = (SELECT station_id FROM users WHERE id = auth.uid())
         OR destination_station_id = (SELECT station_id FROM users WHERE id = auth.uid())
    )
  );

-- SELECT public pour les événements de tracking (lien public)
CREATE POLICY "public_tracking_events_read"
  ON parcel_tracking_events FOR SELECT
  TO anon
  USING (true);
