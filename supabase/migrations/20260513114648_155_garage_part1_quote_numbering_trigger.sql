/*
  # PARTIE 1 — Migration 1.5
  Numérotation automatique des devis + snapshot bus au moment de l'insertion.

  ## Fonctions
  - generate_quote_number(garage_id) : génère DEV-{CODE}-{YEAR}-{NNNN}
  - auto_fill_quote_number() : trigger BEFORE INSERT sur maintenance_quotes

  ## Notes d'adaptation
  - Le champ bus est buses.registration_number (pas registration_plate)
  - bus_company_id est déduit de buses.company_id
*/

CREATE OR REPLACE FUNCTION generate_quote_number(p_garage_id uuid)
RETURNS varchar(50)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code varchar(50);
  v_seq  int;
  v_year int := EXTRACT(YEAR FROM now())::int;
BEGIN
  SELECT code INTO v_code FROM garages WHERE id = p_garage_id;

  SELECT COALESCE(
    MAX(
      CASE
        WHEN quote_number ~ '^DEV-.*-[0-9]{4}-[0-9]{4}$'
        THEN CAST(RIGHT(quote_number, 4) AS int)
        ELSE 0
      END
    ), 0
  ) + 1
  INTO v_seq
  FROM maintenance_quotes
  WHERE garage_id = p_garage_id
    AND EXTRACT(YEAR FROM created_at) = v_year;

  RETURN 'DEV-' || COALESCE(v_code, 'UNK') || '-' || v_year || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION auto_fill_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Générer le numéro de devis si absent
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := generate_quote_number(NEW.garage_id);
  END IF;

  -- Snapshot immatriculation et société du bus
  IF NEW.bus_registration IS NULL OR NEW.bus_registration = '' THEN
    SELECT registration_number INTO NEW.bus_registration
    FROM buses WHERE id = NEW.bus_id;
  END IF;

  -- Renseigner automatiquement la société propriétaire du bus
  IF NEW.bus_company_id IS NULL THEN
    SELECT company_id INTO NEW.bus_company_id
    FROM buses WHERE id = NEW.bus_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fill_quote ON maintenance_quotes;

CREATE TRIGGER trg_auto_fill_quote
BEFORE INSERT ON maintenance_quotes
FOR EACH ROW EXECUTE FUNCTION auto_fill_quote_number();
