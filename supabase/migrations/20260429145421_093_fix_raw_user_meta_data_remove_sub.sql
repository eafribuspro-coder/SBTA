/*
  # Fix raw_user_meta_data : supprimer le champ "sub" parasite

  ## Cause racine identifiée
  Les 13 comptes FAIL ont dans raw_user_meta_data un champ "sub" contenant l'UUID.
  Lors d'un updateUserById via l'API Admin GoTrue, ce champ "sub" cause une erreur
  interne de validation "Database error loading user".
  
  Les comptes SUCCESS ont un raw_user_meta_data sans "sub" (créés via l'API GoTrue normale).
  
  ## Solution
  Supprimer le champ "sub" de raw_user_meta_data pour les 13 comptes FAIL.
  Aussi nettoyer les champs "email" et "phone_verified" qui sont gérés par GoTrue
  et ne doivent pas être dans user_meta_data.
*/

UPDATE auth.users
SET 
  raw_user_meta_data = raw_user_meta_data 
    - 'sub' 
    - 'email' 
    - 'phone_verified',
  updated_at = now()
WHERE raw_user_meta_data ? 'sub'
AND id IN (
  '615397c6-2d60-4bda-b4b0-2efb457a65ab',  -- chauffeur1@sbta.ci
  '50510b79-6866-44b0-8478-1cc04a32a982',  -- chauffeur2@sbta.ci
  '7be5e0bf-eeb5-4362-a774-684b26f93ed6',  -- chauffeur3@sbta.ci
  'a3add3f0-5797-450f-bf0f-d1b9f0d781e7',  -- chefgarage1@sbta.ci
  '2d2f2ddc-68e7-444d-8e3f-303fe2b7aa65',  -- chefgare1@sbta.ci
  '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4',  -- comptable@sbta.ci
  'fd793988-b523-4998-b9a2-7888d9328b78',  -- daf@sbta.ci
  'efa710e0-d523-4810-a7e1-5a8b2d517fe5',  -- gest.express@sbta.ci
  '39550267-e64a-43a3-8036-93dc77ca3e5e',  -- gest.premium@sbta.ci
  'b941e417-7400-46b9-8e82-8e3d8200c57e',  -- guichet1@sbta.ci
  'a3c08153-6711-48f3-b34a-0797ad1af345',  -- meca1@sbta.ci
  'd442237b-c0ad-4113-9c7c-9dd6dbd6f604',  -- planif1@sbta.ci
  '5ea1f6e1-9dfa-4d8a-8fbe-91bdf0c12d70'   -- pompiste1@sbta.ci
);
