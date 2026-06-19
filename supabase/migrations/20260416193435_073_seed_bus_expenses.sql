/*
  # Seed: Charges bus (bus_expenses)

  Insère des charges de bus variées sur les 6 derniers mois.
  Statuts valides: en_attente, validee, rejetee
  Types valides: assurance, taxes, peage, lavage, autres, vignette, visite_technique, parking, amende, taxe_route, carburant, reparation, autre
*/

INSERT INTO bus_expenses (id, bus_id, expense_type, amount, description, expense_date, status, validated_by, created_by)
VALUES
  -- Janvier 2026
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111'::uuid, 'assurance', 185000, 'Prime assurance mensuelle AB-1234-CI', '2026-01-05', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111112'::uuid, 'carburant', 420000, 'Plein carburant trajet Abidjan-Bouaké', '2026-01-07', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111113'::uuid, 'reparation', 95000, 'Vidange + filtres AB-1236-CI', '2026-01-10', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222221'::uuid, 'peage', 12500, 'Péages Abidjan-Yamoussoukro aller-retour', '2026-01-12', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222'::uuid, 'reparation', 360000, '2 pneus arrière neufs AB-2002-CI', '2026-01-15', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333331'::uuid, 'reparation', 220000, 'Réparation système freinage AB-3100-CI', '2026-01-18', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333332'::uuid, 'vignette', 75000, 'Vignette annuelle AB-3101-CI', '2026-01-20', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111114'::uuid, 'lavage', 25000, 'Nettoyage intérieur complet AB-1237-CI', '2026-01-22', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  -- Février 2026
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111115'::uuid, 'assurance', 185000, 'Prime assurance mensuelle AB-1238-CI', '2026-02-03', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111116'::uuid, 'carburant', 390000, 'Carburant mois de février AB-1239-CI', '2026-02-05', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222223'::uuid, 'visite_technique', 145000, 'Révision + visite technique AB-2003-CI', '2026-02-08', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222224'::uuid, 'reparation', 310000, 'Remplacement embrayage AB-2004-CI', '2026-02-12', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333333'::uuid, 'peage', 18750, 'Péages mensuels AB-3102-CI', '2026-02-14', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333334'::uuid, 'lavage', 30000, 'Lavage + désinfection AB-3103-CI', '2026-02-18', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111117'::uuid, 'assurance', 165000, 'Prime assurance mensuelle AB-1240-CI', '2026-02-20', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  -- Mars 2026
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111'::uuid, 'reparation', 110000, 'Vidange + vérification pneumatiques AB-1234-CI', '2026-03-04', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111112'::uuid, 'reparation', 180000, 'Réparation climatisation AB-1235-CI', '2026-03-07', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222225'::uuid, 'reparation', 540000, '3 pneus avant neufs AB-2005-CI', '2026-03-10', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222226'::uuid, 'assurance', 195000, 'Prime assurance mensuelle AB-2006-CI', '2026-03-12', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333335'::uuid, 'carburant', 450000, 'Carburant mois de mars AB-3104-CI', '2026-03-15', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111113'::uuid, 'peage', 15000, 'Péages mensuels AB-1236-CI', '2026-03-20', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  -- Avril 2026
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111114'::uuid, 'visite_technique', 125000, 'Visite technique + révision complète AB-1237-CI', '2026-04-02', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222227'::uuid, 'reparation', 250000, 'Remplacement alternateur AB-2007-CI', '2026-04-05', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333331'::uuid, 'assurance', 210000, 'Prime assurance mensuelle AB-3100-CI', '2026-04-08', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333332'::uuid, 'carburant', 480000, 'Carburant mois avril AB-3101-CI', '2026-04-10', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111115'::uuid, 'lavage', 28000, 'Lavage carrosserie AB-1238-CI', '2026-04-12', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111116'::uuid, 'vignette', 75000, 'Vignette annuelle AB-1239-CI', '2026-04-14', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  -- Mai 2026
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111111'::uuid, 'assurance', 185000, 'Prime assurance mensuelle AB-1234-CI', '2026-05-03', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222221'::uuid, 'reparation', 95000, 'Vidange + filtres AB-2001-CI', '2026-05-06', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333333'::uuid, 'reparation', 165000, 'Remplacement disques frein AB-3102-CI', '2026-05-09', 'validee', '769d5777-7c1d-4beb-b1ae-bb27a0c01429'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111112'::uuid, 'carburant', 405000, 'Carburant mois mai AB-1235-CI', '2026-05-11', 'validee', '6e1f72a0-c1ed-4d58-aae7-95fb23a902a4'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222222'::uuid, 'peage', 21000, 'Péages mai AB-2002-CI', '2026-05-15', 'validee', '1019298d-f43e-4aed-95be-e376e272f043'::uuid, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  -- En attente de validation (avril 2026)
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111117'::uuid, 'reparation', 380000, 'Remplacement moteur démarreur AB-1240-CI', '2026-04-16', 'en_attente', NULL, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b1111111-1111-1111-1111-111111111118'::uuid, 'visite_technique', 130000, 'Révision 80 000 km AB-1241-CI', '2026-04-16', 'en_attente', NULL, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b3333333-3333-3333-3333-333333333334'::uuid, 'reparation', 310000, '2 pneus avant AB-3103-CI', '2026-04-15', 'en_attente', NULL, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid),
  (gen_random_uuid(), 'b2222222-2222-2222-2222-222222222223'::uuid, 'assurance', 195000, 'Renouvellement assurance AB-2003-CI', '2026-04-14', 'en_attente', NULL, 'adb65952-11e5-48c9-be5a-7aaec9024876'::uuid);
