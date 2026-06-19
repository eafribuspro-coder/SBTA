/*
  # MODULE COLIS — PARTIE 1.3 : Table parcel_tracking_events

  Journal complet de suivi de chaque colis.
  Chaque changement de statut + notes manuelles y sont consignés.

  ## Colonnes
  - parcel_id     : référence au colis
  - event_type    : type d'événement (calqué sur les statuts + note_ajoutee)
  - description   : texte libre de l'événement
  - location      : nom de la gare/ville (snapshot texte)
  - station_id    : référence gare
  - performed_by  : agent qui a effectué l'action
  - performer_name: snapshot du nom de l'agent
  - event_at      : horodatage de l'événement
  - metadata      : données supplémentaires en JSON

  ## Index
  - Par parcel_id pour récupérer l'historique d'un colis
  - Par event_at pour les requêtes temporelles
*/

CREATE TABLE IF NOT EXISTS parcel_tracking_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id      uuid REFERENCES parcels(id) ON DELETE CASCADE NOT NULL,
  event_type     text CHECK (event_type IN (
                   'enregistre','mis_en_paquet','expedie',
                   'arrive','livre','retourne','perdu','note_ajoutee'
                 )) NOT NULL,
  description    text,
  location       varchar(255),
  station_id     uuid REFERENCES stations(id),
  performed_by   uuid REFERENCES users(id),
  performer_name varchar(255),
  event_at       timestamptz DEFAULT now(),
  metadata       jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_parcel ON parcel_tracking_events(parcel_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_at     ON parcel_tracking_events(event_at);
