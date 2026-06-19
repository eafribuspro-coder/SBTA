/*
  # Fix calculate_loyalty_points function

  The function referenced s.seat_numbers (schedules alias) but seat_numbers
  belongs to reservations (r). Fixed to use r.seat_numbers.
*/

CREATE OR REPLACE FUNCTION calculate_loyalty_points(p_reservation_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
v_distance numeric;
v_seat_class text;
v_is_online boolean;
v_total_trips integer;
v_points integer := 0;
v_customer_id uuid;
BEGIN
SELECT 
r.customer_id,
rt.distance_km,
CASE 
WHEN r.seat_numbers && ARRAY['VIP1', 'VIP2', 'VIP3', 'VIP4'] THEN 'vip'
WHEN r.seat_numbers && ARRAY['EX1', 'EX2', 'EX3', 'EX4'] THEN 'executive'
ELSE 'standard'
END as seat_class,
CASE WHEN r.booked_by = r.customer_id THEN true ELSE false END as is_online,
u.total_trips
INTO v_customer_id, v_distance, v_seat_class, v_is_online, v_total_trips
FROM reservations r
JOIN schedules s ON r.schedule_id = s.id
JOIN routes rt ON s.route_id = rt.id
JOIN users u ON r.customer_id = u.id
WHERE r.id = p_reservation_id;

v_points := FLOOR(COALESCE(v_distance, 0) / 100) * 10;

IF v_seat_class = 'vip' THEN
v_points := v_points + 5;
ELSIF v_seat_class = 'executive' THEN
v_points := v_points + 15;
END IF;

IF v_is_online THEN
v_points := v_points + 3;
END IF;

IF v_total_trips = 1 THEN
v_points := v_points + 50;
END IF;

IF v_total_trips % 10 = 0 AND v_total_trips > 0 THEN
INSERT INTO loyalty_redemptions (
customer_id,
reward_id,
points_used,
status,
redemption_code,
expires_at
)
SELECT 
v_customer_id,
id,
0,
'validee',
'BONUS-' || UPPER(substring(md5(random()::text) from 1 for 8)),
now() + interval '90 days'
FROM loyalty_rewards_catalog
WHERE reward_type = 'free_trip'
LIMIT 1;
END IF;

RETURN v_points;
END;
$$;
