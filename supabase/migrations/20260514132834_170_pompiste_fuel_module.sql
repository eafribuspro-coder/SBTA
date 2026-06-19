/*
  # Module Pompiste – Gestion Carburant Complète

  Remplace l'ancien processus pompiste par un module métier complet.

  ## Nouvelles tables

  ### fuel_suppliers (Fournisseurs)
  - nom, téléphone, adresse, email, type carburant, contact, statut, observations

  ### fuel_products (Produits carburant)
  - code, désignation, type, unité, prix unitaire, stock minimum, statut

  ### fuel_purchase_orders (Bons de commande)
  - numéro auto, date, fournisseur, produit, quantité, prix unitaire, montant total, statut

  ### fuel_depotages (Entrées cuve)
  - date, cuve, fournisseur, bon de commande, produit, quantité livrée,
    stock avant/après, prix, montant, justificatif, observation, pompiste

  ### fuel_enlevements (Sorties vers bus)
  - date, société, bus, plaque, chauffeur, cuve, produit, quantité,
    prix unitaire, montant, stock avant/après, pompiste, observation

  ## Sécurité
  - RLS sur toutes les tables
  - pompiste peut tout créer/lire
  - admin/daf/comptable peut tout lire
*/

-- ─── FOURNISSEURS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  phone           text,
  address         text,
  email           text,
  fuel_type       text NOT NULL DEFAULT 'gasoil',
  contact_name    text,
  is_active       boolean NOT NULL DEFAULT true,
  observations    text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fuel_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pompiste and admin can read fuel suppliers"
  ON fuel_suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pompiste and admin can insert fuel suppliers"
  ON fuel_suppliers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

CREATE POLICY "Pompiste and admin can update fuel suppliers"
  ON fuel_suppliers FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

-- ─── PRODUITS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL,
  designation     text NOT NULL,
  product_type    text NOT NULL DEFAULT 'gasoil',
  unit            text NOT NULL DEFAULT 'litre',
  unit_price      numeric(12,2) NOT NULL DEFAULT 0,
  min_stock       numeric(12,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fuel_products_code_unique ON fuel_products(code);

ALTER TABLE fuel_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read fuel products"
  ON fuel_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pompiste and admin can insert fuel products"
  ON fuel_products FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

CREATE POLICY "Pompiste and admin can update fuel products"
  ON fuel_products FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

-- ─── BONS DE COMMANDE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_purchase_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text NOT NULL,
  order_date      date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id     uuid NOT NULL REFERENCES fuel_suppliers(id),
  product_id      uuid NOT NULL REFERENCES fuel_products(id),
  quantity        numeric(12,2) NOT NULL,
  unit_price      numeric(12,2) NOT NULL,
  total_amount    numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status          text NOT NULL DEFAULT 'brouillon'
                  CHECK (status IN ('brouillon','valide','livre_partiel','livre_total','annule')),
  observations    text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS fuel_po_number_unique ON fuel_purchase_orders(order_number);

ALTER TABLE fuel_purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read fuel purchase orders"
  ON fuel_purchase_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pompiste and admin can insert fuel purchase orders"
  ON fuel_purchase_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

CREATE POLICY "Pompiste and admin can update fuel purchase orders"
  ON fuel_purchase_orders FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

-- sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS fuel_po_seq START 1;

CREATE OR REPLACE FUNCTION generate_fuel_po_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'BC-CARB-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('fuel_po_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_po_number ON fuel_purchase_orders;
CREATE TRIGGER trg_fuel_po_number
  BEFORE INSERT ON fuel_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION generate_fuel_po_number();

-- ─── DÉPOTAGES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_depotages (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  depot_date            date NOT NULL DEFAULT CURRENT_DATE,
  tank_id               uuid NOT NULL REFERENCES fuel_tanks(id),
  supplier_id           uuid NOT NULL REFERENCES fuel_suppliers(id),
  purchase_order_id     uuid REFERENCES fuel_purchase_orders(id),
  product_id            uuid NOT NULL REFERENCES fuel_products(id),
  quantity_liters       numeric(12,2) NOT NULL,
  stock_before          numeric(12,2) NOT NULL,
  stock_after           numeric(12,2) GENERATED ALWAYS AS (stock_before + quantity_liters) STORED,
  unit_price            numeric(12,2) NOT NULL DEFAULT 0,
  total_amount          numeric(14,2) GENERATED ALWAYS AS (quantity_liters * unit_price) STORED,
  justificatif_url      text,
  observation           text,
  pompiste_id           uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fuel_depotages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read depotages"
  ON fuel_depotages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pompiste and admin can insert depotages"
  ON fuel_depotages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

-- after insert: update tank level
CREATE OR REPLACE FUNCTION after_depotage_update_tank()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE fuel_tanks
  SET current_level_liters = current_level_liters + NEW.quantity_liters
  WHERE id = NEW.tank_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_depotage_update_tank ON fuel_depotages;
CREATE TRIGGER trg_depotage_update_tank
  AFTER INSERT ON fuel_depotages
  FOR EACH ROW EXECUTE FUNCTION after_depotage_update_tank();

-- ─── ENLÈVEMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_enlevements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enlevement_date       date NOT NULL DEFAULT CURRENT_DATE,
  company_id            uuid REFERENCES companies(id),
  bus_id                uuid REFERENCES buses(id),
  license_plate         text,
  driver_id             uuid REFERENCES users(id),
  tank_id               uuid NOT NULL REFERENCES fuel_tanks(id),
  product_id            uuid NOT NULL REFERENCES fuel_products(id),
  quantity_liters       numeric(12,2) NOT NULL,
  unit_price            numeric(12,2) NOT NULL DEFAULT 0,
  total_amount          numeric(14,2) GENERATED ALWAYS AS (quantity_liters * unit_price) STORED,
  stock_before          numeric(12,2) NOT NULL,
  stock_after           numeric(12,2) GENERATED ALWAYS AS (stock_before - quantity_liters) STORED,
  pompiste_id           uuid REFERENCES auth.users(id),
  observation           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fuel_enlevements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read enlevements"
  ON fuel_enlevements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Pompiste and admin can insert enlevements"
  ON fuel_enlevements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('pompiste','admin','daf'))
  );

-- after insert: deduct from tank, add bus expense
CREATE OR REPLACE FUNCTION after_enlevement_update_tank()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- deduct from tank
  UPDATE fuel_tanks
  SET current_level_liters = current_level_liters - NEW.quantity_liters
  WHERE id = NEW.tank_id;

  -- create bus expense (carburant)
  IF NEW.bus_id IS NOT NULL THEN
    INSERT INTO bus_expenses (
      bus_id, expense_date, type, amount, description,
      status, created_at
    ) VALUES (
      NEW.bus_id,
      NEW.enlevement_date,
      'carburant',
      NEW.total_amount,
      'Carburant – enlèvement cuve ' || NEW.tank_id::text,
      'valide',
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enlevement_update_tank ON fuel_enlevements;
CREATE TRIGGER trg_enlevement_update_tank
  AFTER INSERT ON fuel_enlevements
  FOR EACH ROW EXECUTE FUNCTION after_enlevement_update_tank();

-- ─── UPDATED_AT TRIGGERS ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_fuel_module_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_fuel_suppliers_updated_at ON fuel_suppliers;
CREATE TRIGGER trg_fuel_suppliers_updated_at BEFORE UPDATE ON fuel_suppliers FOR EACH ROW EXECUTE FUNCTION update_fuel_module_updated_at();

DROP TRIGGER IF EXISTS trg_fuel_products_updated_at ON fuel_products;
CREATE TRIGGER trg_fuel_products_updated_at BEFORE UPDATE ON fuel_products FOR EACH ROW EXECUTE FUNCTION update_fuel_module_updated_at();

DROP TRIGGER IF EXISTS trg_fuel_po_updated_at ON fuel_purchase_orders;
CREATE TRIGGER trg_fuel_po_updated_at BEFORE UPDATE ON fuel_purchase_orders FOR EACH ROW EXECUTE FUNCTION update_fuel_module_updated_at();

-- indexes
CREATE INDEX IF NOT EXISTS idx_fuel_depotages_tank ON fuel_depotages(tank_id);
CREATE INDEX IF NOT EXISTS idx_fuel_depotages_date ON fuel_depotages(depot_date);
CREATE INDEX IF NOT EXISTS idx_fuel_enlevements_bus ON fuel_enlevements(bus_id);
CREATE INDEX IF NOT EXISTS idx_fuel_enlevements_date ON fuel_enlevements(enlevement_date);
CREATE INDEX IF NOT EXISTS idx_fuel_enlevements_tank ON fuel_enlevements(tank_id);
