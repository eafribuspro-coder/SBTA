/*
  # Fix password hash prefix: $2a$ -> $2b$

  ## Problem
  All 17 users have bcrypt passwords stored with the $2a$ prefix.
  Supabase GoTrue (Auth engine) requires $2b$ prefix to validate passwords.
  $2a$ and $2b$ are cryptographically identical — only the identifier differs.
  This causes "Invalid login credentials" (400) for every user despite correct
  passwords.

  ## Fix
  Replace $2a$ with $2b$ in the encrypted_password column for all affected users.
  No password values change — only the 4-character algorithm identifier.
*/

UPDATE auth.users
SET encrypted_password = '$2b$' || substring(encrypted_password FROM 5)
WHERE encrypted_password LIKE '$2a$%';
