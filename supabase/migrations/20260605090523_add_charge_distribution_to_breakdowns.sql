/*
  Add per-charge-type distribution columns to schedule_breakdowns.
  When an inter-company breakdown split occurs, these columns record
  how each charge category is allocated between the two companies.
  Invariant: for each type, _original + _beneficiary = total for that type.
*/

ALTER TABLE schedule_breakdowns
  ADD COLUMN IF NOT EXISTS charges_ration_original      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_ration_beneficiary   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_carburant_original   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_carburant_beneficiary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_peage_original       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_peage_beneficiary    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_autres_original      numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_autres_beneficiary   numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_total_original       numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_total_beneficiary    numeric DEFAULT 0;
