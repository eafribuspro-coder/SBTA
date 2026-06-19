UPDATE mobile_bookings
SET
  service_fee = service_fee * seats_count,
  total = (unit_price * seats_count) + (service_fee * seats_count),
  updated_at = now()
WHERE seats_count > 1;