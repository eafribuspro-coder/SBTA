/*
  # PARTIE 1 — Migration 1.3
  Ajout de garage_id dans les tables existantes.

  ## Modifications
  - buses : current_garage_id (garage où se trouve actuellement le bus)
  - maintenance_diagnostics : garage_id (garage qui a diagnostiqué)
  - maintenance_work_orders : garage_id + quote_number

  Notes d'adaptation :
  - maintenance_work_orders n'a pas encore les colonnes garage_id / quote_number
  - On utilise IF NOT EXISTS pour sécuriser
*/

-- buses : garage actuel du bus
ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS current_garage_id uuid REFERENCES garages(id);

-- maintenance_diagnostics : garage qui a posé le diagnostic
ALTER TABLE maintenance_diagnostics
  ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES garages(id);

-- maintenance_work_orders : garage qui effectue la réparation + n° devis associé
ALTER TABLE maintenance_work_orders
  ADD COLUMN IF NOT EXISTS garage_id    uuid REFERENCES garages(id);

ALTER TABLE maintenance_work_orders
  ADD COLUMN IF NOT EXISTS quote_number varchar(50);

CREATE INDEX IF NOT EXISTS idx_buses_current_garage ON buses(current_garage_id);
CREATE INDEX IF NOT EXISTS idx_diag_garage          ON maintenance_diagnostics(garage_id);
CREATE INDEX IF NOT EXISTS idx_wo_garage            ON maintenance_work_orders(garage_id);
