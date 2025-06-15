-- Add policies to allow master admins to view all data across all clubs
-- This script adds the necessary policies for the master admin dashboard

-- Allow master admins to view all clubs
CREATE POLICY "Master admins can view all clubs" ON clubs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Allow master admins to view all teams
CREATE POLICY "Master admins can view all teams" ON teams
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Allow master admins to view all coaches
CREATE POLICY "Master admins can view all coaches" ON coaches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Allow master admins to view all players
CREATE POLICY "Master admins can view all players" ON players
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Allow master admins to view all admin profiles
CREATE POLICY "Master admins can view all admin profiles" ON admin_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Allow master admins to update club suspension status
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

-- Create function to check if a user is a master admin
CREATE OR REPLACE FUNCTION is_master_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM master_admins 
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for club statistics
CREATE OR REPLACE VIEW club_statistics AS
SELECT 
  c.id as club_id,
  c.name as club_name,
  c.is_suspended,
  COUNT(DISTINCT p.id) as player_count,
  COUNT(DISTINCT t.id) as team_count,
  COUNT(DISTINCT co.id) as coach_count,
  ap.name as admin_name,
  ap.email as admin_email
FROM 
  clubs c
  LEFT JOIN teams t ON t.club_id = c.id
  LEFT JOIN players p ON p.club_id = c.id
  LEFT JOIN coaches co ON co.club_id = c.id
  LEFT JOIN admin_profiles ap ON ap.user_id = c.admin_id
GROUP BY 
  c.id, c.name, c.is_suspended, ap.name, ap.email; 