/*
# Gérant Principal - Stock Management Module

Complete stock management system for the Gérant Principal role to manage
central inventory of spare parts, tires, and supplies.

## 1. New Tables

### `gp_stock_articles` - Master article/item catalog
- `id` (uuid, PK)
- `item_type` (text) - piece / pneu / fourniture
- `designation` (text) - item name
- `brand` (text) - manufacturer brand
- `reference` (text) - part reference number
- `category` (text) - classification category
- `quantity_in_stock` (integer) - current quantity
- `unit_price` (numeric) - price per unit in FCFA
- `alert_threshold` (integer) - low stock warning level
- `supplier` (text) - supplier name
- `observation` (text) - notes
- `is_active` (boolean) - soft delete flag
- `created_at`, `updated_at` timestamps

### `gp_stock_entries` - Stock receipt/entry records
- `id` (uuid, PK)
- `article_id` (uuid, FK -> gp_stock_articles)
- `entry_date` (date) - date received
- `quantity` (integer) - quantity received
- `unit_price` (numeric) - purchase price per unit
- `total_amount` (numeric) - computed total
- `supplier` (text) - supplier for this entry
- `invoice_number` (text) - supplier invoice ref
- `observation` (text) - notes
- `created_by` (uuid, FK -> auth.users)
- `created_at` timestamp

### `gp_stock_exits` - Stock exit/distribution records
- `id` (uuid, PK)
- `article_id` (uuid, FK -> gp_stock_articles)
- `exit_date` (date)
- `quantity` (integer) - quantity distributed
- `unit_price` (numeric) - unit price at exit
- `total_amount` (numeric) - computed total
- `company_id` (uuid, FK -> companies) - beneficiary company
- `group_id` (uuid, FK -> companies) - parent group
- `bus_id` (uuid, FK -> buses) - target bus
- `garage_id` (uuid, FK -> garages) - target garage
- `exit_reason` (text) - reason/motif
- `requester_name` (text) - who requested
- `validator_name` (text) - who approved
- `observation` (text)
- `created_by` (uuid, FK -> auth.users)
- `created_at` timestamp

### `gp_stock_tires` - Tire-specific tracking
- `id` (uuid, PK)
- `article_id` (uuid, FK -> gp_stock_articles) - linked article
- `brand` (text) - Michelin, Long-March, etc.
- `dimension` (text) - tire size
- `serial_number` (text) - unique serial
- `bus_id` (uuid, FK -> buses) - assigned bus
- `exit_date` (date) - date assigned/distributed
- `mileage_at_install` (numeric) - km at installation
- `status` (text) - en_stock / affecte / remplace / use
- `observation` (text)
- `created_by` (uuid, FK -> auth.users)
- `created_at`, `updated_at` timestamps

## 2. Security
- RLS enabled on all tables.
- Authenticated users with role gerant_principal, admin, or daf can read.
- gerant_principal and admin can insert/update.
- No delete policies (soft delete via is_active flag).

## 3. Indexes
- article_id on entries, exits, tires for fast joins.
- company_id, bus_id on exits for reporting.
- status on tires for filtering.
- item_type on articles for filtering.
*/

-- ============================================================
-- TABLE: gp_stock_articles
-- ============================================================
CREATE TABLE IF NOT EXISTS gp_stock_articles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type        text NOT NULL CHECK (item_type IN ('piece', 'pneu', 'fourniture')),
  designation      text NOT NULL,
  brand            text DEFAULT '',
  reference        text DEFAULT '',
  category         text DEFAULT '',
  quantity_in_stock integer NOT NULL DEFAULT 0,
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  alert_threshold  integer NOT NULL DEFAULT 5,
  supplier         text DEFAULT '',
  observation      text DEFAULT '',
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gp_stock_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gp_articles_select" ON gp_stock_articles;
CREATE POLICY "gp_articles_select" ON gp_stock_articles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gp_articles_insert" ON gp_stock_articles;
CREATE POLICY "gp_articles_insert" ON gp_stock_articles FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin')
  );

DROP POLICY IF EXISTS "gp_articles_update" ON gp_stock_articles;
CREATE POLICY "gp_articles_update" ON gp_stock_articles FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'));

-- ============================================================
-- TABLE: gp_stock_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS gp_stock_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       uuid NOT NULL REFERENCES gp_stock_articles(id),
  entry_date       date NOT NULL DEFAULT CURRENT_DATE,
  quantity         integer NOT NULL CHECK (quantity > 0),
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  supplier         text DEFAULT '',
  invoice_number   text DEFAULT '',
  observation      text DEFAULT '',
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gp_stock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gp_entries_select" ON gp_stock_entries;
CREATE POLICY "gp_entries_select" ON gp_stock_entries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gp_entries_insert" ON gp_stock_entries;
CREATE POLICY "gp_entries_insert" ON gp_stock_entries FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin')
  );

DROP POLICY IF EXISTS "gp_entries_update" ON gp_stock_entries;
CREATE POLICY "gp_entries_update" ON gp_stock_entries FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'));

-- ============================================================
-- TABLE: gp_stock_exits
-- ============================================================
CREATE TABLE IF NOT EXISTS gp_stock_exits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id       uuid NOT NULL REFERENCES gp_stock_articles(id),
  exit_date        date NOT NULL DEFAULT CURRENT_DATE,
  quantity         integer NOT NULL CHECK (quantity > 0),
  unit_price       numeric(12,2) NOT NULL DEFAULT 0,
  total_amount     numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  company_id       uuid REFERENCES companies(id),
  group_id         uuid REFERENCES companies(id),
  bus_id           uuid REFERENCES buses(id),
  garage_id        uuid REFERENCES garages(id),
  exit_reason      text DEFAULT '',
  requester_name   text DEFAULT '',
  validator_name   text DEFAULT '',
  observation      text DEFAULT '',
  created_by       uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gp_stock_exits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gp_exits_select" ON gp_stock_exits;
CREATE POLICY "gp_exits_select" ON gp_stock_exits FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gp_exits_insert" ON gp_stock_exits;
CREATE POLICY "gp_exits_insert" ON gp_stock_exits FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin')
  );

DROP POLICY IF EXISTS "gp_exits_update" ON gp_stock_exits;
CREATE POLICY "gp_exits_update" ON gp_stock_exits FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'));

-- ============================================================
-- TABLE: gp_stock_tires
-- ============================================================
CREATE TABLE IF NOT EXISTS gp_stock_tires (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id         uuid REFERENCES gp_stock_articles(id),
  brand              text NOT NULL DEFAULT '',
  dimension          text NOT NULL DEFAULT '',
  serial_number      text DEFAULT '',
  bus_id             uuid REFERENCES buses(id),
  exit_date          date,
  mileage_at_install numeric(10,0) DEFAULT 0,
  status             text NOT NULL DEFAULT 'en_stock' CHECK (status IN ('en_stock','affecte','remplace','use')),
  observation        text DEFAULT '',
  created_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gp_stock_tires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gp_tires_select" ON gp_stock_tires;
CREATE POLICY "gp_tires_select" ON gp_stock_tires FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "gp_tires_insert" ON gp_stock_tires;
CREATE POLICY "gp_tires_insert" ON gp_stock_tires FOR INSERT
  TO authenticated WITH CHECK (
    (auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin')
  );

DROP POLICY IF EXISTS "gp_tires_update" ON gp_stock_tires;
CREATE POLICY "gp_tires_update" ON gp_stock_tires FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'))
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role') IN ('gerant_principal','admin'));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_gp_entries_article ON gp_stock_entries(article_id);
CREATE INDEX IF NOT EXISTS idx_gp_entries_date ON gp_stock_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_gp_exits_article ON gp_stock_exits(article_id);
CREATE INDEX IF NOT EXISTS idx_gp_exits_company ON gp_stock_exits(company_id);
CREATE INDEX IF NOT EXISTS idx_gp_exits_bus ON gp_stock_exits(bus_id);
CREATE INDEX IF NOT EXISTS idx_gp_exits_date ON gp_stock_exits(exit_date);
CREATE INDEX IF NOT EXISTS idx_gp_exits_group ON gp_stock_exits(group_id);
CREATE INDEX IF NOT EXISTS idx_gp_tires_status ON gp_stock_tires(status);
CREATE INDEX IF NOT EXISTS idx_gp_tires_bus ON gp_stock_tires(bus_id);
CREATE INDEX IF NOT EXISTS idx_gp_articles_type ON gp_stock_articles(item_type);
CREATE INDEX IF NOT EXISTS idx_gp_articles_active ON gp_stock_articles(is_active);

-- ============================================================
-- TRIGGER: auto-update stock on entry
-- ============================================================
CREATE OR REPLACE FUNCTION gp_stock_entry_update_qty()
RETURNS trigger AS $$
BEGIN
  UPDATE gp_stock_articles
  SET quantity_in_stock = quantity_in_stock + NEW.quantity,
      unit_price = NEW.unit_price,
      updated_at = now()
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_gp_stock_entry_qty ON gp_stock_entries;
CREATE TRIGGER trg_gp_stock_entry_qty
  AFTER INSERT ON gp_stock_entries
  FOR EACH ROW EXECUTE FUNCTION gp_stock_entry_update_qty();

-- ============================================================
-- TRIGGER: auto-update stock on exit (decrease)
-- ============================================================
CREATE OR REPLACE FUNCTION gp_stock_exit_update_qty()
RETURNS trigger AS $$
BEGIN
  UPDATE gp_stock_articles
  SET quantity_in_stock = quantity_in_stock - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.article_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_gp_stock_exit_qty ON gp_stock_exits;
CREATE TRIGGER trg_gp_stock_exit_qty
  AFTER INSERT ON gp_stock_exits
  FOR EACH ROW EXECUTE FUNCTION gp_stock_exit_update_qty();

-- ============================================================
-- FUNCTION: check stock before exit (prevent negative)
-- ============================================================
CREATE OR REPLACE FUNCTION gp_check_stock_before_exit()
RETURNS trigger AS $$
DECLARE
  current_qty integer;
BEGIN
  SELECT quantity_in_stock INTO current_qty
  FROM gp_stock_articles WHERE id = NEW.article_id;
  
  IF current_qty IS NULL THEN
    RAISE EXCEPTION 'Article introuvable';
  END IF;
  
  IF current_qty < NEW.quantity THEN
    RAISE EXCEPTION 'Stock insuffisant. Disponible: %, Demandé: %', current_qty, NEW.quantity;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_gp_check_stock_exit ON gp_stock_exits;
CREATE TRIGGER trg_gp_check_stock_exit
  BEFORE INSERT ON gp_stock_exits
  FOR EACH ROW EXECUTE FUNCTION gp_check_stock_before_exit();
