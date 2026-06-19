/*
  # Fix SECURITY DEFINER functions missing search_path

  ## Problem
  Several SECURITY DEFINER functions lack `SET search_path = public`, causing
  PostgREST schema introspection to fail with "Database error querying schema".
  When PostgREST resolves function types without a fixed search_path, the
  postgres role's search_path may differ, causing resolution failures.

  ## Changes
  1. Add SET search_path = public to all SECURITY DEFINER functions missing it:
     - check_bus_availability
     - check_driver_availability
     - is_admin
     - update_bus_fill_rate
     - credit_loyalty_points_after_reservation
     - generate_fuel_voucher_after_schedule
     - log_role_change
     - log_suspension
  2. Reload PostgREST schema cache
*/

-- Fix check_bus_availability
CREATE OR REPLACE FUNCTION public.check_bus_availability(
  p_bus_id uuid,
  p_departure_datetime timestamp with time zone,
  p_arrival_datetime timestamp with time zone,
  p_schedule_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(is_available boolean, conflict_schedule_id uuid, conflict_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_bus_status text;
v_conflict_id uuid;
BEGIN
SELECT status INTO v_bus_status FROM buses WHERE id = p_bus_id;

IF v_bus_status IS NULL THEN
RETURN QUERY SELECT false, NULL::uuid, 'Bus introuvable'::text;
RETURN;
END IF;

IF v_bus_status NOT IN ('disponible', 'en_service') THEN
RETURN QUERY SELECT false, NULL::uuid, 'Bus non disponible (statut: ' || v_bus_status || ')'::text;
RETURN;
END IF;

SELECT id INTO v_conflict_id
FROM schedules
WHERE bus_id = p_bus_id
AND (p_schedule_id IS NULL OR id != p_schedule_id)
AND ((departure_datetime, arrival_datetime) OVERLAPS (p_departure_datetime, p_arrival_datetime))
LIMIT 1;

IF v_conflict_id IS NOT NULL THEN
RETURN QUERY SELECT false, v_conflict_id, 'Bus déjà affecté sur ce créneau'::text;
RETURN;
END IF;

RETURN QUERY SELECT true, NULL::uuid, NULL::text;
END;
$function$;

-- Fix check_driver_availability
CREATE OR REPLACE FUNCTION public.check_driver_availability(
  p_driver_id uuid,
  p_departure_datetime timestamp with time zone,
  p_arrival_datetime timestamp with time zone,
  p_schedule_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(is_available boolean, conflict_schedule_id uuid, conflict_message text, hours_today numeric, hours_week numeric, hours_remaining_today numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_conflict_id uuid;
v_hours_today NUMERIC := 0;
v_hours_week NUMERIC := 0;
v_trip_duration NUMERIC;
BEGIN
SELECT id INTO v_conflict_id
FROM schedules
WHERE driver_id = p_driver_id
AND (p_schedule_id IS NULL OR id != p_schedule_id)
AND ((departure_datetime, arrival_datetime) OVERLAPS (p_departure_datetime, p_arrival_datetime))
LIMIT 1;

IF v_conflict_id IS NOT NULL THEN
RETURN QUERY SELECT false, v_conflict_id, 'Chauffeur déjà affecté sur ce créneau'::text, 0::numeric, 0::numeric, 0::numeric;
RETURN;
END IF;

SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (arrival_datetime - departure_datetime)) / 3600), 0)
INTO v_hours_today
FROM schedules
WHERE driver_id = p_driver_id
AND DATE(departure_datetime) = DATE(p_departure_datetime)
AND (p_schedule_id IS NULL OR id != p_schedule_id);

SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (arrival_datetime - departure_datetime)) / 3600), 0)
INTO v_hours_week
FROM schedules
WHERE driver_id = p_driver_id
AND DATE_TRUNC('week', departure_datetime) = DATE_TRUNC('week', p_departure_datetime)
AND (p_schedule_id IS NULL OR id != p_schedule_id);

v_trip_duration := EXTRACT(EPOCH FROM (p_arrival_datetime - p_departure_datetime)) / 3600;

IF v_hours_today + v_trip_duration > 10 THEN
RETURN QUERY SELECT false, NULL::uuid, 'Dépassement limite journalière (10h)'::text, v_hours_today, v_hours_week, (10 - v_hours_today)::numeric;
RETURN;
END IF;

RETURN QUERY SELECT true, NULL::uuid, NULL::text, v_hours_today, v_hours_week, (10 - v_hours_today)::numeric;
END;
$function$;

-- Fix is_admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
SELECT EXISTS (
SELECT 1 FROM public.users
WHERE id = user_id AND role = 'admin'
);
$function$;

-- Fix update_bus_fill_rate
CREATE OR REPLACE FUNCTION public.update_bus_fill_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_schedule_id UUID;
v_bus_id UUID;
v_total_seats INTEGER;
v_reserved_seats INTEGER;
v_fill_rate DECIMAL(5,2);
BEGIN
IF TG_OP = 'DELETE' THEN
v_schedule_id := OLD.schedule_id;
ELSE
v_schedule_id := NEW.schedule_id;
END IF;

SELECT s.bus_id, b.total_seats
INTO v_bus_id, v_total_seats
FROM schedules s
JOIN buses b ON b.id = s.bus_id
WHERE s.id = v_schedule_id;

IF v_bus_id IS NULL THEN
RETURN COALESCE(NEW, OLD);
END IF;

SELECT COALESCE(SUM(total_seats), 0)
INTO v_reserved_seats
FROM reservations
WHERE schedule_id = v_schedule_id
AND status IN ('confirmee', 'en_attente');

IF v_total_seats > 0 THEN
v_fill_rate := (v_reserved_seats::DECIMAL / v_total_seats::DECIMAL * 100)::DECIMAL(5,2);
ELSE
v_fill_rate := 0;
END IF;

UPDATE schedules
SET
seats_reserved = v_reserved_seats,
seats_available = v_total_seats - v_reserved_seats,
updated_at = now()
WHERE id = v_schedule_id;

UPDATE buses
SET
fill_rate_current = v_fill_rate,
updated_at = now()
WHERE id = v_bus_id;

UPDATE buses b
SET
fill_rate_avg_30d = (
SELECT COALESCE(AVG((r.seats_reserved::DECIMAL / b.total_seats::DECIMAL * 100)), 0)::DECIMAL(5,2)
FROM schedules s
LEFT JOIN LATERAL (
SELECT COALESCE(SUM(total_seats), 0) as seats_reserved
FROM reservations
WHERE schedule_id = s.id AND status IN ('confirmee', 'terminee')
) r ON true
WHERE s.bus_id = b.id
AND s.departure_datetime >= now() - INTERVAL '30 days'
AND s.departure_datetime <= now()
),
fill_rate_avg_90d = (
SELECT COALESCE(AVG((r.seats_reserved::DECIMAL / b.total_seats::DECIMAL * 100)), 0)::DECIMAL(5,2)
FROM schedules s
LEFT JOIN LATERAL (
SELECT COALESCE(SUM(total_seats), 0) as seats_reserved
FROM reservations
WHERE schedule_id = s.id AND status IN ('confirmee', 'terminee')
) r ON true
WHERE s.bus_id = b.id
AND s.departure_datetime >= now() - INTERVAL '90 days'
AND s.departure_datetime <= now()
),
updated_at = now()
WHERE b.id = v_bus_id;

RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Fix credit_loyalty_points_after_reservation
CREATE OR REPLACE FUNCTION public.credit_loyalty_points_after_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_points_to_credit INTEGER;
v_current_total_trips INTEGER;
v_new_tier TEXT;
BEGIN
IF NEW.status != 'confirmee' OR NEW.customer_id IS NULL THEN
RETURN NEW;
END IF;

IF TG_OP = 'UPDATE' AND OLD.status = 'confirmee' THEN
RETURN NEW;
END IF;

v_points_to_credit := FLOOR(NEW.total_price / 100)::INTEGER;

SELECT total_trips INTO v_current_total_trips
FROM users
WHERE id = NEW.customer_id;

v_current_total_trips := COALESCE(v_current_total_trips, 0) + 1;

IF v_current_total_trips % 10 = 0 THEN
v_points_to_credit := v_points_to_credit + 500;

v_new_tier := CASE
WHEN v_current_total_trips >= 50 THEN 'platinum'
WHEN v_current_total_trips >= 30 THEN 'gold'
WHEN v_current_total_trips >= 10 THEN 'silver'
ELSE 'bronze'
END;

UPDATE users
SET
loyalty_tier = v_new_tier,
loyalty_points = loyalty_points + v_points_to_credit,
total_trips = v_current_total_trips,
updated_at = now()
WHERE id = NEW.customer_id;

INSERT INTO loyalty_points_log (customer_id, points_change, reason, reservation_id)
VALUES (
NEW.customer_id,
500,
'Bonus 10ème voyage - Tier changé à ' || v_new_tier,
NEW.id
);
ELSE
UPDATE users
SET
loyalty_points = loyalty_points + v_points_to_credit,
total_trips = v_current_total_trips,
updated_at = now()
WHERE id = NEW.customer_id;
END IF;

INSERT INTO loyalty_points_log (customer_id, points_change, reason, reservation_id)
VALUES (
NEW.customer_id,
FLOOR(NEW.total_price / 100)::INTEGER,
'Points pour réservation confirmée',
NEW.id
);

RETURN NEW;
END;
$function$;

-- Fix generate_fuel_voucher_after_schedule
CREATE OR REPLACE FUNCTION public.generate_fuel_voucher_after_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
v_route_distance DECIMAL(8,2);
v_bus_fuel_consumption DECIMAL(5,2);
v_estimated_liters DECIMAL(10,2);
v_fuel_price DECIMAL(10,2);
v_estimated_amount DECIMAL(10,2);
v_voucher_number TEXT;
BEGIN
IF TG_OP = 'INSERT' AND NEW.bus_id IS NOT NULL THEN

SELECT
r.distance_km,
b.fuel_consumption
INTO
v_route_distance,
v_bus_fuel_consumption
FROM routes r
CROSS JOIN buses b
WHERE r.id = NEW.route_id
AND b.id = NEW.bus_id;

IF v_route_distance IS NULL OR v_route_distance = 0 THEN
v_route_distance := 100;
END IF;

IF v_bus_fuel_consumption IS NULL OR v_bus_fuel_consumption = 0 THEN
v_bus_fuel_consumption := 28.5;
END IF;

v_estimated_liters := (v_route_distance * v_bus_fuel_consumption / 100.0)::DECIMAL(10,2);
v_fuel_price := 700;
v_estimated_amount := (v_estimated_liters * v_fuel_price)::DECIMAL(10,2);

v_voucher_number := 'FV-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('fuel_voucher_seq')::TEXT, 6, '0');

INSERT INTO fuel_vouchers (
voucher_number,
schedule_id,
bus_id,
driver_id,
estimated_liters,
estimated_amount,
fuel_price_per_liter,
status,
created_at
) VALUES (
v_voucher_number,
NEW.id,
NEW.bus_id,
NEW.driver_id,
v_estimated_liters,
v_estimated_amount,
v_fuel_price,
'genere',
now()
);
END IF;

RETURN NEW;
END;
$function$;

-- Fix log_role_change
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
IF OLD.role IS DISTINCT FROM NEW.role THEN
NEW.role_changed_at = now();
INSERT INTO activity_logs (user_id, target_id, target_type, action, description, old_values, new_values)
VALUES (
auth.uid(),
NEW.id,
'user',
'role_changed',
'Rôle modifié de ' || OLD.role || ' à ' || NEW.role,
jsonb_build_object('role', OLD.role),
jsonb_build_object('role', NEW.role)
);
END IF;
RETURN NEW;
END;
$function$;

-- Fix log_suspension
CREATE OR REPLACE FUNCTION public.log_suspension()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'suspended' THEN
NEW.suspended_at = now();
INSERT INTO activity_logs (user_id, target_id, target_type, action, description, old_values, new_values)
VALUES (
auth.uid(),
NEW.id,
'user',
'account_suspended',
'Compte suspendu',
jsonb_build_object('status', OLD.status),
jsonb_build_object('status', NEW.status, 'reason', NEW.suspension_reason)
);
END IF;
RETURN NEW;
END;
$function$;

-- Ensure admin password is set correctly
UPDATE auth.users
SET encrypted_password = extensions.crypt('Admin123!', extensions.gen_salt('bf', 10))
WHERE email = 'admin@sbta.ci';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
