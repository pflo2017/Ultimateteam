-- Add is_suspended column to clubs table if it doesn't exist
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

-- Create a function to check if a club is suspended
CREATE OR REPLACE FUNCTION is_club_suspended(p_club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM clubs 
    WHERE id = p_club_id 
    AND is_suspended = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user belongs to a suspended club
CREATE OR REPLACE FUNCTION is_user_from_suspended_club(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_suspended BOOLEAN := false;
BEGIN
  -- Check if user is a club admin
  SELECT c.is_suspended INTO v_is_suspended
  FROM clubs c
  WHERE c.admin_id = p_user_id
  LIMIT 1;
  
  IF v_is_suspended THEN
    RETURN true;
  END IF;
  
  -- Check if user is a coach
  SELECT c.is_suspended INTO v_is_suspended
  FROM clubs c
  JOIN coaches co ON co.club_id = c.id
  WHERE co.user_id = p_user_id
  LIMIT 1;
  
  IF v_is_suspended THEN
    RETURN true;
  END IF;
  
  -- Check if user is a parent (through player-parent relationship)
  SELECT c.is_suspended INTO v_is_suspended
  FROM clubs c
  JOIN teams t ON t.club_id = c.id
  JOIN players p ON p.team_id = t.id
  JOIN parent_children pc ON pc.player_id = p.id
  JOIN parents pa ON pa.id = pc.parent_id
  WHERE pa.user_id = p_user_id
  LIMIT 1;
  
  RETURN COALESCE(v_is_suspended, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a policy to allow master admins to view all clubs
CREATE POLICY "Master admins can view all clubs" ON clubs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Create a policy to allow master admins to update club suspension status
CREATE POLICY "Master admins can update club suspension" ON clubs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
); 