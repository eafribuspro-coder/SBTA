ALTER TABLE mobile_bookings ADD COLUMN IF NOT EXISTS origin_station text;
ALTER TABLE mobile_bookings ADD COLUMN IF NOT EXISTS destination_station text;