/*
  # Add missing columns to buses table
  
  1. Changes
    - Add missing columns used by the frontend application:
      - brand: Marque du bus
      - fuel_type: Type de carburant (diesel, essence, hybride)
      - fuel_capacity: Capacité du réservoir en litres
      - fuel_consumption: Consommation en L/100km
      - insurance_expiry: Date d'expiration de l'assurance
      - vignette_expiry: Date d'expiration de la vignette
      - technical_inspection_expiry: Date de visite technique
      - photo_url: URL de la photo du bus
      - class: Classe du bus (standard, vip, executive)
      - capacity: Capacité totale (alias de total_seats pour compatibilité)
    
    - Rename amenities_ids to amenities for consistency with frontend
  
  2. Reason
    - The frontend code expects these columns to exist
    - Missing columns prevent bus creation/editing
*/

-- Add brand column (manufacturer is already present, brand is the common name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'brand'
  ) THEN
    ALTER TABLE buses ADD COLUMN brand text;
  END IF;
END $$;

-- Add fuel-related columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'fuel_type'
  ) THEN
    ALTER TABLE buses ADD COLUMN fuel_type text DEFAULT 'diesel' CHECK (fuel_type IN ('diesel', 'essence', 'hybride', 'electrique'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'fuel_capacity'
  ) THEN
    ALTER TABLE buses ADD COLUMN fuel_capacity decimal(10,2) DEFAULT 200;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'fuel_consumption'
  ) THEN
    ALTER TABLE buses ADD COLUMN fuel_consumption decimal(5,2) DEFAULT 25;
  END IF;
END $$;

-- Add document expiry columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'insurance_expiry'
  ) THEN
    ALTER TABLE buses ADD COLUMN insurance_expiry date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'vignette_expiry'
  ) THEN
    ALTER TABLE buses ADD COLUMN vignette_expiry date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'technical_inspection_expiry'
  ) THEN
    ALTER TABLE buses ADD COLUMN technical_inspection_expiry date;
  END IF;
END $$;

-- Add photo URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE buses ADD COLUMN photo_url text;
  END IF;
END $$;

-- Add class column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'class'
  ) THEN
    ALTER TABLE buses ADD COLUMN class text DEFAULT 'standard' CHECK (class IN ('standard', 'vip', 'executive'));
  END IF;
END $$;

-- Add capacity as alias/computed column (for compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'capacity'
  ) THEN
    ALTER TABLE buses ADD COLUMN capacity integer;
  END IF;
END $$;

-- Rename amenities_ids to amenities
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'amenities_ids'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buses' AND column_name = 'amenities'
  ) THEN
    ALTER TABLE buses RENAME COLUMN amenities_ids TO amenities;
  END IF;
END $$;