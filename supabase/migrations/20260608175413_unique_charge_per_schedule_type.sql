/*
# Prevent Duplicate Charges Per Voyage (ration, carburant, peage)

## Purpose
Ensure that for a given voyage (schedule_id), each standard charge type
(ration, carburant_complement, peage) can only be recorded once.
This prevents accidental or fraudulent double-entry of charges.

The "autres" charge type is excluded from this constraint since multiple
"autres" entries with different descriptions are legitimate.

## Changes
- New unique partial index on counter_charges(schedule_id, charge_type)
  WHERE charge_type IN ('ration', 'carburant_complement', 'peage')

## Notes
1. This is a DB-level safety net. The frontend also validates before insert.
2. Existing duplicate data (if any) must be cleaned before the index can be created.
*/

-- Clean up any existing duplicates by keeping only the first entry per (schedule_id, charge_type)
DELETE FROM counter_charges
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY schedule_id, charge_type
      ORDER BY created_at ASC
    ) AS rn
    FROM counter_charges
    WHERE charge_type IN ('ration', 'carburant_complement', 'peage')
  ) ranked
  WHERE rn > 1
);

-- Create unique partial index
DROP INDEX IF EXISTS idx_counter_charges_unique_type_per_schedule;
CREATE UNIQUE INDEX idx_counter_charges_unique_type_per_schedule
  ON counter_charges(schedule_id, charge_type)
  WHERE charge_type IN ('ration', 'carburant_complement', 'peage');
