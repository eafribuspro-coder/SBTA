/*
  # Module Gestion des Cuves

  Permet à l'administrateur de gérer les cuves de carburant.

  ## Nouvelle table : `fuel_tanks`

  ### Colonnes
  - `id` (uuid, pk)
  - `name` – Nom de la cuve
  - `code` – Code unique de la cuve
  - `address` – Adresse physique
  - `city` – Ville
  - `region` – Région
  - `phone` – Numéro de téléphone
  - `capacity_liters` – Capacité totale en litres
  - `current_level_liters` – Niveau actuel en litres
  - `fuel_type` – Type de carburant (gasoil, essence, etc.)
  - `pompiste_id` – FK vers users (rôle pompiste)
  - `is_active` – Statut actif/inactif
  - `observations` – Remarques libres
  - `created_at`, `updated_at`

  ## Sécurité
  - RLS activé
  - Admins peuvent tout faire
  - Utilisateurs authentifiés peuvent lire
*/

CREATE TABLE IF NOT EXISTS fuel_tanks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  code                 text NOT NULL,
  address              text,
  city                 text,
  region               text,
  phone                text,
  capacity_liters      numeric(12,2) NOT NULL DEFAULT 0,
  current_level_liters numeric(12,2) NOT NULL DEFAULT 0,
  fuel_type            text NOT NULL DEFAULT 'gasoil',
  pompiste_id          uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active            boolean NOT NULL DEFAULT true,
  observations         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- unique code per tank
CREATE UNIQUE INDEX IF NOT EXISTS fuel_tanks_code_unique ON fuel_tanks(code);

ALTER TABLE fuel_tanks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view fuel tanks"
  ON fuel_tanks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert fuel tanks"
  ON fuel_tanks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

CREATE POLICY "Admin can update fuel tanks"
  ON fuel_tanks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_fuel_tanks_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_tanks_updated_at ON fuel_tanks;
CREATE TRIGGER trg_fuel_tanks_updated_at
  BEFORE UPDATE ON fuel_tanks
  FOR EACH ROW EXECUTE FUNCTION update_fuel_tanks_updated_at();

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_pompiste ON fuel_tanks(pompiste_id);
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_city ON fuel_tanks(city);
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_is_active ON fuel_tanks(is_active);
