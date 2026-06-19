ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY[
  'admin','agent_colis','carburant','charge_achat','chauffeur','chef_garage','chef_gare',
  'client','comptable','daf','gestionnaire','guichetier','mecanicien','planificateur',
  'pompiste','rh','superviseur_colis','gerant_principal','responsable_assurance'
]));

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check CHECK (role = ANY (ARRAY[
  'admin','agent_colis','carburant','charge_achat','chauffeur','chef_garage','chef_gare',
  'client','comptable','daf','gestionnaire','guichetier','mecanicien','planificateur',
  'pompiste','rh','superviseur_colis','gerant_principal','responsable_assurance'
]));