-- First check which column currently exists
DO $$
BEGIN
    -- Check if processed_by_admin exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payment_collections' AND column_name = 'processed_by_admin'
    ) THEN
        -- Rename the column from processed_by_admin to is_processed
        ALTER TABLE payment_collections 
        RENAME COLUMN processed_by_admin TO is_processed;
        RAISE NOTICE 'Column renamed from processed_by_admin to is_processed';
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payment_collections' AND column_name = 'is_processed'
    ) THEN
        -- If neither column exists, add the is_processed column
        ALTER TABLE payment_collections
        ADD COLUMN is_processed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added new column is_processed';
    ELSE
        RAISE NOTICE 'Column is_processed already exists';
    END IF;
END $$;

-- Drop and recreate the function to include the is_processed field
DROP FUNCTION IF EXISTS mark_payment_as_collected(UUID, UUID, TEXT);

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
  -- Update the player record
  UPDATE players
  SET 
    cash_collected = TRUE,
    collected_date = NOW(),
    collected_by_coach_id = p_coach_id
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