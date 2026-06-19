/*
  # Add expense traceability columns to comptable_stock_movements

  Adds columns to link stock movements back to vehicle expenses and garages:
  - garage_id: FK to garages (nullable)
  - unit_price: price at time of movement
  - expense_reference: UUID of the linked vehicle_expense (nullable)

  Also adds an index on stock_item_id for faster lookups.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptable_stock_movements' AND column_name = 'garage_id'
  ) THEN
    ALTER TABLE comptable_stock_movements ADD COLUMN garage_id uuid REFERENCES garages(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptable_stock_movements' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE comptable_stock_movements ADD COLUMN unit_price numeric(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptable_stock_movements' AND column_name = 'expense_reference'
  ) THEN
    ALTER TABLE comptable_stock_movements ADD COLUMN expense_reference uuid;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comptable_stock_movements_item ON comptable_stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_comptable_stock_movements_expense ON comptable_stock_movements(expense_reference);
