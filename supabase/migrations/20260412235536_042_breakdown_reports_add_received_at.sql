/*
  # Ajout de la colonne received_at sur breakdown_reports

  ## Contexte
  Le chef de gare doit pouvoir marquer une panne comme "reçue" et conserver
  l'horodatage de la réception.

  ## Changements
  - Ajout de `received_at` (timestamptz nullable) sur breakdown_reports
*/

ALTER TABLE breakdown_reports
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT NULL;
