/*
  # Add grid_layout column to bus_seat_config

  1. Changes
    - `bus_seat_config` table: adds `grid_layout` (jsonb) column to store the full GridLayout
      structure (with aisle cells, row types, etc.) needed to restore the seat plan editor
      when editing an existing bus in the admin wizard.

  2. Reason
    - The existing `seat_layout` column stores only reservable seats (flat format, no aisle cells).
    - The wizard's SeatPlanBuilder requires the full GridLayout (all cells including aisles, 
      row_type, is_aisle flags) to display and edit the plan correctly.
    - Without this, editing a bus resets the seat plan to a blank default.

  3. Notes
    - Existing rows will have NULL in grid_layout; this is handled gracefully (wizard auto-generates
      from stored params when grid_layout is missing).
    - No data loss risk — additive migration only.
*/

ALTER TABLE bus_seat_config
  ADD COLUMN IF NOT EXISTS grid_layout jsonb;
