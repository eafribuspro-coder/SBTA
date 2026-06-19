/*
  # Ajout des sociétés SBTA

  Insertion des 6 nouvelles sociétés SBTA dans la table companies.
  Utilisation de ON CONFLICT DO NOTHING pour éviter les doublons si le code existe déjà.
*/

INSERT INTO public.companies (name, code, is_active) VALUES
  ('SBTA-BLO', 'SBTA-BLO', true),
  ('SBTA-BSA', 'SBTA-BSA', true),
  ('SBTA-BAB', 'SBTA-BAB', true),
  ('SBTA-BAZ', 'SBTA-BAZ', true),
  ('SBTA-BNO', 'SBTA-BNO', true),
  ('SBTA-BFA', 'SBTA-BFA', true)
ON CONFLICT (code) DO NOTHING;
