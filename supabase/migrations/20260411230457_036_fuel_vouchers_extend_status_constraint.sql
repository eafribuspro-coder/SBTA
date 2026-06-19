/*
  # Extend fuel_vouchers status constraint

  The original status check only allowed: genere, valide_comptable, utilise, annule.
  We extend it to also support the workflow statuses used by the chauffeur and comptable pages:
  - pending_refuel (alias for genere: waiting to be refueled)
  - pending_validation (submitted by driver, waiting comptable validation)
  - validated (comptable approved)
  - rejected (comptable rejected)
*/

ALTER TABLE fuel_vouchers DROP CONSTRAINT IF EXISTS fuel_vouchers_status_check;

ALTER TABLE fuel_vouchers
  ADD CONSTRAINT fuel_vouchers_status_check
  CHECK (status = ANY (ARRAY[
    'genere',
    'pending_refuel',
    'pending_validation',
    'valide_comptable',
    'validated',
    'utilise',
    'rejected',
    'annule'
  ]));
