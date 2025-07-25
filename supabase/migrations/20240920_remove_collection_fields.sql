-- Remove collection-related columns from players table
ALTER TABLE players
DROP COLUMN IF EXISTS cash_collected,
DROP COLUMN IF EXISTS collected_date,
DROP COLUMN IF EXISTS collected_by_coach_id;

-- Update mark_payment_as_collected function to not update these columns
CREATE OR REPLACE FUNCTION mark_payment_as_collected(
  p_player_id UUID,
  p_coach_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_collection_id UUID;
BEGIN
  -- Update the player's last_payment_date (keep this part)
  UPDATE players
  SET 
    last_payment_date = NOW()::date -- Cast to date type
  WHERE id = p_player_id;
  
  -- Create a record in the payment_collections table
  INSERT INTO payment_collections (
    player_id,
    coach_id,
    collected_date,
    is_processed,
    notes
  ) VALUES (
    p_player_id,
    p_coach_id,
    NOW(),
    FALSE,
    p_notes
  )
  RETURNING id INTO v_collection_id;
  
  RETURN v_collection_id;
END;
$$; 