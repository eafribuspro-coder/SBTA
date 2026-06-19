/*
  # Enrich buses and bus_seat_config tables for integrated seat wizard

  ## Summary
  This migration prepares the data model for the new integrated seat configuration
  wizard embedded directly in the bus record. The Config Sièges standalone menu
  is removed; all seat layout configuration is now done from within the bus sheet.

  ## Changes to `buses` table
  - `driver_position` — which side the driver sits (gauche/droite), default gauche
  - `bus_deck_type` — simple (standard) or imperial (double-decker), default simple
  - `sleeping_type` — aucun / couchettes / mixte, default aucun
  - `max_allowed_capacity` — legal or operational capacity ceiling
  - `lower_deck_config_id` — FK to bus_seat_config for the lower deck (imperial buses)
  - `upper_deck_config_id` — FK to bus_seat_config for the upper deck (imperial buses)

  ## Changes to `bus_seat_config` table
  - `bus_id` — FK back to the owning bus (for single-bus configs)
  - `deck_level` — simple / inferieur / superieur, default simple
  - `driver_position` — inherited from bus for visual rendering
  - `total_columns` — total column count (replaces left+right split in new format)
  - `aisle_after_columns` — int[] of column indices where aisles are inserted
  - `default_seat_type` — normal / vip / couchette
  - `generated_at` — timestamp when the layout was auto-generated
  - `last_modified_by` — FK to users table (audit trail)

  ## Security
  No new tables; existing RLS policies on buses and bus_seat_config remain in force.
*/

-- ─── buses ────────────────────────────────────────────────────────────────────

ALTER TABLE buses
  ADD COLUMN IF NOT EXISTS driver_position text
    CHECK (driver_position IN ('gauche','droite'))
    DEFAULT 'gauche',

  ADD COLUMN IF NOT EXISTS bus_deck_type text
    CHECK (bus_deck_type IN ('simple','imperial'))
    DEFAULT 'simple',

  ADD COLUMN IF NOT EXISTS sleeping_type text
    CHECK (sleeping_type IN ('aucun','couchettes','mixte'))
    DEFAULT 'aucun',

  ADD COLUMN IF NOT EXISTS max_allowed_capacity int,

  ADD COLUMN IF NOT EXISTS lower_deck_config_id uuid
    REFERENCES bus_seat_config(id),

  ADD COLUMN IF NOT EXISTS upper_deck_config_id uuid
    REFERENCES bus_seat_config(id);

-- ─── bus_seat_config ──────────────────────────────────────────────────────────

ALTER TABLE bus_seat_config
  ADD COLUMN IF NOT EXISTS bus_id uuid
    REFERENCES buses(id),

  ADD COLUMN IF NOT EXISTS deck_level text
    CHECK (deck_level IN ('simple','inferieur','superieur'))
    DEFAULT 'simple',

  ADD COLUMN IF NOT EXISTS driver_position text
    CHECK (driver_position IN ('gauche','droite'))
    DEFAULT 'gauche',

  ADD COLUMN IF NOT EXISTS total_columns int,

  ADD COLUMN IF NOT EXISTS aisle_after_columns int[]
    DEFAULT '{}',

  ADD COLUMN IF NOT EXISTS default_seat_type text
    CHECK (default_seat_type IN ('normal','vip','couchette'))
    DEFAULT 'normal',

  ADD COLUMN IF NOT EXISTS generated_at timestamptz,

  ADD COLUMN IF NOT EXISTS last_modified_by uuid
    REFERENCES users(id);
