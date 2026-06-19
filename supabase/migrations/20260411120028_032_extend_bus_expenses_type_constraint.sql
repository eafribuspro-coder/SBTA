/*
  # Extend bus_expenses expense_type check constraint

  ## Problem
  The existing constraint only allows 5 values (assurance, taxes, peage, lavage, autres).
  The comptable form sends values like vignette, visite_technique, parking, amende, etc.

  ## Changes
  - Drop existing check constraint
  - Add a new, broader constraint with all needed types
*/

ALTER TABLE bus_expenses DROP CONSTRAINT IF EXISTS bus_expenses_expense_type_check;

ALTER TABLE bus_expenses
  ADD CONSTRAINT bus_expenses_expense_type_check
  CHECK (expense_type = ANY (ARRAY[
    'assurance',
    'taxes',
    'peage',
    'lavage',
    'autres',
    'vignette',
    'visite_technique',
    'parking',
    'amende',
    'taxe_route',
    'carburant',
    'reparation',
    'autre'
  ]));
