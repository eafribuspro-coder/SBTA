/*
  # Seat Layout V2 — New JSONB Format

  ## Summary
  Updates the bus_seat_config table to support a richer seat layout format
  with per-seat type metadata (normal, vip, handicape, hors_service) and
  proper row/column labeling (1A, 1B, 2C, etc.).

  ## Changes
  - Adds `seat_layout_v2` JSONB column for new structured format
  - Existing `seat_layout` column preserved (backward compat)
  - Updates RLS: no new tables, existing policies unchanged

  ## New seat_layout_v2 format
  [
    {
      "row": 1,
      "seats": [
        { "id": "1A", "label": "1A", "side": "left",  "type": "normal",       "position": { "row": 1, "col": 1 } },
        { "id": "1B", "label": "1B", "side": "left",  "type": "vip",          "position": { "row": 1, "col": 2 } },
        { "id": "1C", "label": "1C", "side": "right", "type": "handicape",    "position": { "row": 1, "col": 3 } },
        { "id": "1D", "label": "1D", "side": "right", "type": "hors_service", "position": { "row": 1, "col": 4 } }
      ]
    }
  ]
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_seat_config' AND column_name = 'seat_layout_v2'
  ) THEN
    ALTER TABLE bus_seat_config ADD COLUMN seat_layout_v2 jsonb;
  END IF;
END $$;
