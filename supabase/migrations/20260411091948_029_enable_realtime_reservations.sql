/*
  # Enable Realtime on reservations table

  ## Purpose
  Activates full replica identity on the reservations table so that
  Supabase Realtime can broadcast INSERT, UPDATE, and DELETE events
  with complete row data (before and after images).

  ## Changes
  - Sets REPLICA IDENTITY FULL on the reservations table
  - Required for real-time seat map updates across guichetier and client portals
*/

ALTER TABLE reservations REPLICA IDENTITY FULL;
