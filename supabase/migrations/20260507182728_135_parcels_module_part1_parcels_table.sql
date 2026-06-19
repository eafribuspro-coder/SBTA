/*
  # MODULE COLIS — PARTIE 1.2 : Table parcels

  Nouvelle table principale pour la gestion des colis SBTA.

  ## Colonnes principales
  - Codes de référence : parcel_code (court, 6 chiffres), reference (format MM/JJ-HHmm-XXXX), daily_sequence
  - Expéditeur : nom, téléphone, adresse
  - Destinataire : nom, téléphone, ville, adresse
  - Gares : origin_station_id, destination_station_id
  - Transport : schedule_id (voyage assigné), bus_id
  - Détail colis : valeur déclarée, frais, priorité, nature, description, photos
  - Statut workflow : enregistre → mis_en_paquet → expedie → arrive → livre
  - Timestamps de chaque étape avec acteur
  - Notification : sms_sent_at, whatsapp_sent_at, tracking_url
  - Audit : company_id, created_at, updated_at

  ## Index
  Optimisés pour les recherches par gare, statut, code, téléphone destinataire, date.
*/

CREATE TABLE IF NOT EXISTS parcels (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Codes de référence
  parcel_code              varchar(20) UNIQUE NOT NULL,
  reference                varchar(50) UNIQUE NOT NULL,
  daily_sequence           int NOT NULL,

  -- Expéditeur
  sender_name              varchar(255) NOT NULL,
  sender_phone             varchar(50) NOT NULL,
  sender_address           text,

  -- Destinataire
  recipient_name           varchar(255) NOT NULL,
  recipient_phone          varchar(255) NOT NULL,
  recipient_city           varchar(100) NOT NULL,
  recipient_address        text,

  -- Gares
  origin_station_id        uuid REFERENCES stations(id) NOT NULL,
  destination_station_id   uuid REFERENCES stations(id) NOT NULL,

  -- Transport
  schedule_id              uuid REFERENCES schedules(id),
  bus_id                   uuid REFERENCES buses(id),

  -- Détails du colis
  declared_value           decimal(15,2) DEFAULT 0,
  delivery_fee             decimal(15,2) NOT NULL,
  sms_tracking_fee         decimal(10,2) DEFAULT 100,
  total_amount             decimal(15,2) GENERATED ALWAYS AS (delivery_fee + sms_tracking_fee) STORED,
  priority                 text CHECK (priority IN ('standard','urgent','fragile')) DEFAULT 'standard',
  planned_date             date,
  nature                   text CHECK (nature IN (
                             'autre','electronique','vetement','document',
                             'alimentaire','medicament','electromenager','fragile'
                           )) DEFAULT 'autre',
  content_description      text NOT NULL,
  parcel_photos            text[],
  notes                    text,

  -- Statut & workflow
  status                   text CHECK (status IN (
                             'enregistre','mis_en_paquet','expedie',
                             'arrive','livre','retourne','perdu'
                           )) DEFAULT 'enregistre',

  -- Timestamps workflow
  registered_at            timestamptz DEFAULT now(),
  registered_by            uuid REFERENCES users(id) NOT NULL,
  packaged_at              timestamptz,
  packaged_by              uuid REFERENCES users(id),
  shipped_at               timestamptz,
  shipped_by               uuid REFERENCES users(id),
  arrived_at               timestamptz,
  arrived_by               uuid REFERENCES users(id),
  delivered_at             timestamptz,
  delivered_by             uuid REFERENCES users(id),
  delivery_recipient       varchar(255),
  delivery_id_proof        varchar(100),

  -- Notification
  sms_sent_at              timestamptz,
  whatsapp_sent_at         timestamptz,
  tracking_url             text,

  -- Audit
  company_id               uuid REFERENCES companies(id),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_parcels_origin_station      ON parcels(origin_station_id);
CREATE INDEX IF NOT EXISTS idx_parcels_destination_station ON parcels(destination_station_id);
CREATE INDEX IF NOT EXISTS idx_parcels_status              ON parcels(status);
CREATE INDEX IF NOT EXISTS idx_parcels_parcel_code         ON parcels(parcel_code);
CREATE INDEX IF NOT EXISTS idx_parcels_reference           ON parcels(reference);
CREATE INDEX IF NOT EXISTS idx_parcels_recipient_phone     ON parcels(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_parcels_registered_at       ON parcels(registered_at);
CREATE INDEX IF NOT EXISTS idx_parcels_schedule            ON parcels(schedule_id);
