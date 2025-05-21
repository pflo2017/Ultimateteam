-- Add fields to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS cash_collected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS collected_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS collected_by_coach_id UUID REFERENCES coaches(id);

-- Create payment collections table
CREATE TABLE IF NOT EXISTS payment_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  coach_id UUID REFERENCES coaches(id),
  amount DECIMAL DEFAULT 0,
  collected_date TIMESTAMP DEFAULT NOW(),
  is_processed BOOLEAN DEFAULT FALSE,
  processed_date TIMESTAMP,
  notes TEXT
);

-- Add RLS policies
ALTER TABLE payment_collections ENABLE ROW LEVEL SECURITY;

-- Coaches can insert and view their own collections
CREATE POLICY coach_collections_insert ON payment_collections
  FOR INSERT TO authenticated
  WITH CHECK (coach_id IN (
    SELECT id FROM coaches 
    WHERE coaches.id IN (SELECT coach_id FROM coach_session_info())
  ));

CREATE POLICY coach_collections_select ON payment_collections
  FOR SELECT TO authenticated
  USING (coach_id IN (
    SELECT id FROM coaches 
    WHERE coaches.id IN (SELECT coach_id FROM coach_session_info())
  ));

-- Admins have full access
CREATE POLICY admin_collections_all ON payment_collections
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clubs 
    WHERE clubs.admin_id = auth.uid()
  ));

-- Create function to mark payment as collected
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