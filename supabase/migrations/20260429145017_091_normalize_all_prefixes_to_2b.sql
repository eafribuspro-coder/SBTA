/*
  # Normalisation finale de tous les préfixes bcrypt en $2b$

  ## Contexte
  Les hash sont valides (Password123! vérifié via pgcrypto avec $2a$),
  mais les préfixes sont mixtes ($2a$ et $2b$) suite aux manipulations précédentes.
  GoTrue (Go) utilise golang.org/x/crypto/bcrypt qui reconnaît $2b$ uniquement.
  
  ## Solution
  Forcer TOUS les comptes en $2b$ en une seule passe.
*/

UPDATE auth.users
SET 
  encrypted_password = '$2b$' || SUBSTRING(encrypted_password FROM 5),
  updated_at = now()
WHERE encrypted_password LIKE '$2a$%';
