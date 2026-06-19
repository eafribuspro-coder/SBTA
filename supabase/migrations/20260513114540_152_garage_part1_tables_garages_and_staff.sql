/*
  # PARTIE 1 — Migrations Garage Module (1.1 + 1.2)

  ## 1.1 — Table garages
  Garages indépendants des sociétés. Pas de company_id.
  Un garage sert TOUTES les sociétés de la holding.

  Colonnes :
  - id, name, code (unique), garage_type (central/sous_garage)
  - parent_garage_id (hiérarchie entre garages)
  - address, city, region
  - phone, email
  - station_id (gare opérationnelle associée, optionnel)
  - chef_garage_id (responsable)
  - max_vehicles, status, observations
  - created_by, updated_by, created_at, updated_at

  ## 1.2 — Table garage_staff
  Équipe affectée à un garage (chef, mécanicien, aide-mécanicien, technicien).

  ## Security
  - RLS activé sur les deux tables (policies ajoutées en 1.8)
*/

-- ── 1.1 : garages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS garages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name             varchar(255) NOT NULL,
  code             varchar(50)  UNIQUE NOT NULL,

  garage_type      text NOT NULL DEFAULT 'sous_garage'
                   CHECK (garage_type IN ('central','sous_garage')),

  parent_garage_id uuid REFERENCES garages(id),

  address          text,
  city             varchar(100) NOT NULL,
  region           varchar(100),

  phone            varchar(50),
  email            varchar(255),

  station_id       uuid REFERENCES stations(id),

  chef_garage_id   uuid REFERENCES users(id),

  max_vehicles     int DEFAULT 20,

  status           text DEFAULT 'actif'
                   CHECK (status IN ('actif','inactif','archive')),
  observations     text,

  created_by       uuid REFERENCES users(id),
  updated_by       uuid REFERENCES users(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_garages_station    ON garages(station_id);
CREATE INDEX IF NOT EXISTS idx_garages_chef       ON garages(chef_garage_id);
CREATE INDEX IF NOT EXISTS idx_garages_type       ON garages(garage_type);
CREATE INDEX IF NOT EXISTS idx_garages_parent     ON garages(parent_garage_id);
CREATE INDEX IF NOT EXISTS idx_garages_status     ON garages(status);

-- ── 1.2 : garage_staff ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS garage_staff (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id      uuid REFERENCES garages(id) ON DELETE CASCADE NOT NULL,
  user_id        uuid REFERENCES users(id) NOT NULL,
  role_in_garage text NOT NULL
                 CHECK (role_in_garage IN (
                   'chef_garage','mecanicien','aide_mecanicien','technicien'
                 )),
  assigned_at    timestamptz DEFAULT now(),
  assigned_by    uuid REFERENCES users(id),
  is_active      boolean DEFAULT true,
  notes          text,
  UNIQUE (garage_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_garage_staff_garage ON garage_staff(garage_id);
CREATE INDEX IF NOT EXISTS idx_garage_staff_user   ON garage_staff(user_id);

ALTER TABLE garages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE garage_staff ENABLE ROW LEVEL SECURITY;
