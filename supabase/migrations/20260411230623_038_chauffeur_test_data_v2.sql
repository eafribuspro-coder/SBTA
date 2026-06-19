/*
  # Chauffeur test data v2 — schedules, fuel vouchers, hours log

  Corrected driver_hours_log schema: uses start_time, end_time, total_hours.
*/

-- Additional schedules for chauffeur1
INSERT INTO schedules (
  id, route_id, bus_id, driver_id, departure_station_id, arrival_station_id,
  departure_datetime, arrival_datetime, status, seats_available, seats_reserved,
  price, created_by, route_name, estimated_duration_minutes
) VALUES
  (
    gen_random_uuid(),
    '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
    '85305342-7127-4ace-a632-95a0bcc6f9e0',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() + INTERVAL '1 day')::timestamptz,
    (NOW() + INTERVAL '1 day' + INTERVAL '4 hours 30 minutes')::timestamptz,
    'planifie', 45, 30, 7000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Bouaké', 270
  ),
  (
    gen_random_uuid(),
    '4a73fc03-335e-45c6-8700-259f908fff18',
    '2ce86140-58e4-4375-99d8-a21621addca3',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() + INTERVAL '3 days')::timestamptz,
    (NOW() + INTERVAL '3 days' + INTERVAL '2 hours 30 minutes')::timestamptz,
    'planifie', 55, 42, 5000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Yamoussoukro', 150
  ),
  (
    gen_random_uuid(),
    '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
    'd664877e-674f-4a7c-acb6-e6bfdfafe2ef',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() + INTERVAL '7 days')::timestamptz,
    (NOW() + INTERVAL '7 days' + INTERVAL '4 hours 30 minutes')::timestamptz,
    'planifie', 45, 18, 7000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Bouaké', 270
  ),
  (
    gen_random_uuid(),
    '4a73fc03-335e-45c6-8700-259f908fff18',
    '85305342-7127-4ace-a632-95a0bcc6f9e0',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() - INTERVAL '3 days')::timestamptz,
    (NOW() - INTERVAL '3 days' + INTERVAL '2 hours 30 minutes')::timestamptz,
    'termine', 55, 50, 5000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Yamoussoukro', 150
  ),
  (
    gen_random_uuid(),
    '99fe18db-7c60-4c88-bf5a-c760cfbaff23',
    '2ce86140-58e4-4375-99d8-a21621addca3',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() - INTERVAL '5 days')::timestamptz,
    (NOW() - INTERVAL '5 days' + INTERVAL '4 hours 30 minutes')::timestamptz,
    'termine', 45, 40, 7000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Bouaké', 270
  ),
  (
    gen_random_uuid(),
    '4a73fc03-335e-45c6-8700-259f908fff18',
    'd664877e-674f-4a7c-acb6-e6bfdfafe2ef',
    '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
    'be221fd9-0d42-4f94-89de-096bbf85f803',
    '60112270-26a7-4f15-af4e-8010eb1deeeb',
    (NOW() - INTERVAL '10 days')::timestamptz,
    (NOW() - INTERVAL '10 days' + INTERVAL '2 hours 30 minutes')::timestamptz,
    'annule', 55, 5, 5000,
    'c1ce21d0-5bd9-47e4-8e00-96110fb8fee1',
    'Abidjan - Yamoussoukro', 150
  )
ON CONFLICT DO NOTHING;

-- Update existing genere voucher with pricing info
UPDATE fuel_vouchers
SET estimated_unit_price = 695, departure_mileage = 120000
WHERE id = 'eda7a7c3-8f28-4f30-b0e8-7cfbbc064ca2';

-- Validated voucher from past completed trip
DO $$
DECLARE v_sched uuid;
BEGIN
  SELECT id INTO v_sched FROM schedules
  WHERE driver_id = '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b'
    AND route_name = 'Abidjan - Bouaké' AND status = 'termine'
  ORDER BY departure_datetime DESC LIMIT 1;

  IF v_sched IS NOT NULL THEN
    INSERT INTO fuel_vouchers (
      voucher_number, schedule_id, bus_id, driver_id,
      estimated_liters, estimated_amount, estimated_unit_price, fuel_price_per_liter,
      departure_mileage, actual_liters, actual_unit_price, actual_amount, current_mileage,
      fuel_station, fuel_city, notes, status, created_at, submitted_at
    ) VALUES (
      'FV-VALIDE-001', v_sched, '2ce86140-58e4-4375-99d8-a21621addca3',
      '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
      160, 111200, 695, 695, 124200,
      157, 695, 109115, 124357,
      'Shell Bouaké Centre', 'Bouaké', 'Ravitaillement normal',
      'validated', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '4 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Pending validation voucher
DO $$
DECLARE v_sched uuid;
BEGIN
  SELECT id INTO v_sched FROM schedules
  WHERE driver_id = '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b'
    AND route_name = 'Abidjan - Yamoussoukro' AND status = 'termine'
  ORDER BY departure_datetime DESC LIMIT 1;

  IF v_sched IS NOT NULL THEN
    INSERT INTO fuel_vouchers (
      voucher_number, schedule_id, bus_id, driver_id,
      estimated_liters, estimated_amount, estimated_unit_price, fuel_price_per_liter,
      departure_mileage, actual_liters, actual_unit_price, actual_amount, current_mileage,
      fuel_station, fuel_city, notes, status, created_at, submitted_at
    ) VALUES (
      'FV-PENDING-001', v_sched, '85305342-7127-4ace-a632-95a0bcc6f9e0',
      '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b',
      95, 66025, 695, 695, 98500,
      98, 695, 68110, 98598,
      'Total Energies Yamoussoukro', 'Yamoussoukro', 'Plein effectué sans difficulté',
      'pending_validation', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours'
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Driver hours log entries (using actual schema)
DO $$
DECLARE v_sched uuid;
BEGIN
  SELECT id INTO v_sched FROM schedules
  WHERE driver_id = '4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b'
    AND status = 'termine'
  ORDER BY departure_datetime DESC LIMIT 1;

  IF v_sched IS NOT NULL THEN
    INSERT INTO driver_hours_log (driver_id, schedule_id, start_time, end_time, total_hours, created_at)
    VALUES
      ('4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b', v_sched,
       NOW() - INTERVAL '5 days',
       NOW() - INTERVAL '5 days' + INTERVAL '4 hours 30 minutes',
       4.5, NOW()),
      ('4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b', v_sched,
       NOW() - INTERVAL '3 days',
       NOW() - INTERVAL '3 days' + INTERVAL '2 hours 30 minutes',
       2.5, NOW()),
      ('4aa248cf-0ca8-4fef-9e5b-2f54b5d4aa3b', v_sched,
       NOW() - INTERVAL '1 day',
       NOW() - INTERVAL '1 day' + INTERVAL '6 hours',
       6.0, NOW())
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
