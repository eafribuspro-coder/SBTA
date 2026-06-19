/*
  # Ajouter station_agent_colis_id dans la table stations

  ## Changement
  - Nouvelle colonne `station_agent_colis_id` (uuid, nullable, FK vers users)
  - Permet d'associer un agent colis à une gare, comme station_manager_id le fait pour chef_gare
  - Index pour accélérer les lookups

  ## Sécurité
  - Pas de changement RLS (la table stations utilise déjà ses propres policies)
*/

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS station_agent_colis_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stations_agent_colis_id
  ON stations (station_agent_colis_id);
