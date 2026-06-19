/*
  # Reload PostgREST schema cache

  Forces PostgREST to refresh its schema cache after adding
  the parcels and parcel_tracking_events tables.
*/
NOTIFY pgrst, 'reload schema';
