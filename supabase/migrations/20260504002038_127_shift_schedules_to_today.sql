/*
  # Décaler les voyages du 03/05/2026 vers aujourd'hui (04/05/2026)

  Les 3 voyages de démonstration Adjamé–Bouaké ont leur departure_datetime
  au 03/05/2026. Pour que l'écran d'affichage et les guichetiers puissent
  travailler dessus aujourd'hui (04/05/2026), on décale toutes leurs dates
  d'exactement 1 jour en avant.

  Schedules concernés :
  - 969634c9 : 09h30 → 14h30
  - 9991c66e : 12h30 → 17h30
  - fa343dd8 : 16h30 → 21h30

  Statut remis à 'planifie' pour permettre la vente et l'embarquement.
*/
UPDATE schedules
SET
  departure_datetime = departure_datetime + INTERVAL '1 day',
  arrival_datetime   = arrival_datetime   + INTERVAL '1 day',
  status             = 'planifie'
WHERE id IN (
  '969634c9-7337-461e-975d-ab33efba15be',
  '9991c66e-da37-4937-9d19-d64c1ecdf1db',
  'fa343dd8-69fd-4586-af14-8d78705cad43'
);
