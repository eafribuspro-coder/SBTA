/*
  # Add 'retard' status to schedules status check constraint

  ## Problem
  The Chef de Gare interface allows signaling a delay ("Signaler retard") on a
  schedule, which sets the status to 'retard'. However, the database check
  constraint `schedules_status_check` only permits: planifie, en_cours, termine,
  annule — causing an error on update.

  ## Solution
  Replace the check constraint to include 'retard' as a valid status value.

  ## Modified Constraints
  - `schedules_status_check` — now allows: planifie, en_cours, termine, annule, retard
*/

ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_status_check;

ALTER TABLE schedules ADD CONSTRAINT schedules_status_check
  CHECK (status = ANY (ARRAY['planifie', 'en_cours', 'termine', 'annule', 'retard']));
