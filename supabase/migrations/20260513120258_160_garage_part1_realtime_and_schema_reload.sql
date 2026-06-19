/*
  # PARTIE 1 — Migration 1.10
  Activer Realtime sur maintenance_quotes + reload du schéma PostgREST.

  ## Realtime
  La table maintenance_quotes est ajoutée à la publication realtime
  afin que le chef de garage soit notifié en temps réel lorsqu'un devis
  est validé ou rejeté par le comptable.

  ## Schema reload
  Force PostgREST à recharger le schéma pour exposer les nouvelles tables.
*/

-- Activer Realtime sur maintenance_quotes
ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_quotes;

-- Reload du schéma PostgREST
NOTIFY pgrst, 'reload schema';
