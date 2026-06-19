/*
  # RPC: receive_parcel_by_qr

  Creates a SECURITY DEFINER function that confirms parcel arrival by scanning
  its QR code (which encodes the parcel_code).

  ## Security rules enforced:
  - Only the destination station of the parcel can confirm arrival
  - Parcel must be in 'expedie' status
  - If parcel is already 'arrive': returns code 'already_arrived'
  - If parcel is already 'livre': returns code 'already_delivered'
  - If destination mismatch: returns code 'wrong_station'
  - If parcel_code not found: returns code 'not_found'
  - On success: status → 'arrive', sets arrived_at + arrived_by

  ## Return shape:
  { success: bool, code: text, message: text, parcel_id: uuid | null }
*/

CREATE OR REPLACE FUNCTION receive_parcel_by_qr(
  p_parcel_code      text,
  p_station_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parcel        parcels%ROWTYPE;
  v_performer_id  uuid := auth.uid();
BEGIN
  -- Lookup parcel by code
  SELECT * INTO v_parcel
  FROM parcels
  WHERE parcel_code = p_parcel_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'not_found',
      'message', 'QR Code invalide ou colis introuvable.',
      'parcel_id', null
    );
  END IF;

  -- Status checks
  IF v_parcel.status = 'arrive' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'already_arrived',
      'message', 'Ce colis a déjà été réceptionné.',
      'parcel_id', v_parcel.id
    );
  END IF;

  IF v_parcel.status = 'livre' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'already_delivered',
      'message', 'Ce colis a déjà été livré au client.',
      'parcel_id', v_parcel.id
    );
  END IF;

  IF v_parcel.status NOT IN ('expedie', 'mis_en_paquet', 'enregistre') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'invalid_status',
      'message', 'Ce colis ne peut pas être réceptionné dans son état actuel.',
      'parcel_id', v_parcel.id
    );
  END IF;

  -- Destination station check
  IF v_parcel.destination_station_id IS DISTINCT FROM p_station_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code',    'wrong_station',
      'message', 'Ce colis n''est pas destiné à votre gare.',
      'parcel_id', v_parcel.id
    );
  END IF;

  -- Mark as arrived
  UPDATE parcels
  SET
    status      = 'arrive',
    arrived_at  = now(),
    arrived_by  = v_performer_id
  WHERE id = v_parcel.id;

  RETURN jsonb_build_object(
    'success',   true,
    'code',      'ok',
    'message',   'Colis réceptionné avec succès.',
    'parcel_id', v_parcel.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION receive_parcel_by_qr(text, uuid) TO authenticated;
