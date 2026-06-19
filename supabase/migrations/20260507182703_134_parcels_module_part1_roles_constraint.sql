/*
  # MODULE COLIS — PARTIE 1.1 : Mise à jour contrainte rôles users

  Ajout des deux nouveaux rôles colis dans la contrainte CHECK de la table users :
  - superviseur_colis : supervision globale de tous les colis toutes agences
  - agent_colis       : gestion des colis de sa gare uniquement
*/

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin','daf','comptable','rh','gestionnaire',
    'chauffeur','guichetier','chef_garage','mecanicien',
    'planificateur','pompiste','chef_gare',
    'superviseur_colis',
    'agent_colis',
    'client'
  ));
