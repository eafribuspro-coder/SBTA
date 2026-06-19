/*
  # Fix final : préfixe $2a$ → $2b$ après regénération des hash

  pgcrypto.crypt() génère des hash avec le préfixe $2a$.
  GoTrue de Supabase requiert $2b$.
  On applique le remplacement de préfixe sur tous les comptes
  qui ont un hash valide $2a$ (regénéré à l'étape précédente).
  
  Le hash bcrypt est identique entre $2a$ et $2b$ — seul le marqueur
  de version change, les deux sont acceptés par la librairie bcrypt Go.
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$' || SUBSTRING(encrypted_password FROM 5),
  updated_at = now()
WHERE encrypted_password LIKE '$2a$%';
