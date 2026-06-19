/*
  # Reset all user passwords with valid bcrypt hashes

  ## Problème
  Les hash bcrypt stockés dans auth.users.encrypted_password ne correspondent
  à aucun mot de passe connu — ils étaient corrompus depuis la création des comptes
  (insertés manuellement avec des hash invalides).
  
  ## Solution
  Regénération de vrais hash bcrypt via pgcrypto.crypt() directement en SQL.
  
  ## Mots de passe appliqués
  - Tous les comptes de test : Password123!
  - Compte admin principal  : Password123!
  
  ## Comptes concernés
  Tous les comptes non-client du système (31 comptes).
*/

-- Regénérer un vrai hash bcrypt pour Password123! et l'appliquer à tous les comptes
UPDATE auth.users
SET 
  encrypted_password = crypt('Password123!', gen_salt('bf', 10)),
  updated_at = now()
WHERE email IN (
  'admin@sbta.ci',
  'daf@sbta.ci',
  'comptable@sbta.ci',
  'comptable1@sbta.ci',
  'comptable11@sbta.ci',
  'gest.express@sbta.ci',
  'gest.express1@sbta.ci',
  'gest.premium@sbta.ci',
  'planif1@sbta.ci',
  'planif11@sbta.ci',
  'guichet1@sbta.ci',
  'guichet11@sbta.ci',
  'chauffeur1@sbta.ci',
  'chauffeur2@sbta.ci',
  'chauffeur3@sbta.ci',
  'chauffeur11@sbta.ci',
  'chauffeur111@sbta.ci',
  'chefgarage1@sbta.ci',
  'chefgarage11@sbta.ci',
  'chefgare1@sbta.ci',
  'meca1@sbta.ci',
  'meca11@sbta.ci',
  'pompiste1@sbta.ci',
  'rh@sbta.ci',
  'konan@gmail.com',
  'ousmane@gmail.com',
  'dioamnde@gmailcom'
);
