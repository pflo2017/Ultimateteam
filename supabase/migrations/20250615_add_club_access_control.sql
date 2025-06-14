-- Add club access control and payment tracking
-- This migration adds capabilities for the master admin dashboard without affecting existing app functionality

-- Add column to existing clubs table to control access
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_access_enabled BOOLEAN DEFAULT true;

-- Create payment tracking table for club billing
CREATE TABLE IF NOT EXISTS club_payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  club_id UUID REFERENCES clubs(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  player_count INTEGER NOT NULL,
  rate_per_player DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  payment_date DATE,
  payment_reference TEXT,
  notes TEXT,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create view to get current active player counts per club for billing
CREATE OR REPLACE VIEW club_active_players AS
SELECT 
  c.id as club_id,
  c.name as club_name,
  COUNT(DISTINCT p.id) as active_player_count
FROM 
  clubs c
  LEFT JOIN teams t ON t.club_id = c.id
  LEFT JOIN players p ON p.team_id = t.id
WHERE 
  p.is_active = true
GROUP BY 
  c.id, c.name;

-- Create the access check function but don't enforce it in the app yet
CREATE OR REPLACE FUNCTION check_club_access(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_enabled BOOLEAN;
BEGIN
  -- Check if admin account
  SELECT c.is_access_enabled INTO v_is_enabled
  FROM clubs c
  WHERE c.admin_id = p_user_id;
  
  IF v_is_enabled IS NOT NULL THEN
    RETURN v_is_enabled;
  END IF;
  
  -- Check if coach account
  SELECT c.is_access_enabled INTO v_is_enabled
  FROM clubs c
  JOIN coaches co ON co.club_id = c.id
  WHERE co.user_id = p_user_id;
  
  IF v_is_enabled IS NOT NULL THEN
    RETURN v_is_enabled;
  END IF;
  
  -- Check if parent account (through children's teams)
  SELECT c.is_access_enabled INTO v_is_enabled
  FROM clubs c
  JOIN teams t ON t.club_id = c.id
  JOIN players p ON p.team_id = t.id
  JOIN parent_children pc ON pc.player_id = p.id
  JOIN parents pa ON pa.id = pc.parent_id
  WHERE pa.user_id = p_user_id
  LIMIT 1;
  
  RETURN COALESCE(v_is_enabled, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create master_admins table for the web dashboard
CREATE TABLE IF NOT EXISTS master_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add policies for the new tables
ALTER TABLE club_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_admins ENABLE ROW LEVEL SECURITY;

-- Master admins can see all payment history
CREATE POLICY master_admin_view_payment_history ON club_payment_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM master_admins ma 
      WHERE ma.user_id = auth.uid()
    )
  );

-- Master admins can modify payment history
CREATE POLICY master_admin_modify_payment_history ON club_payment_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM master_admins ma 
      WHERE ma.user_id = auth.uid()
    )
  );

-- Super admins can manage master admins
CREATE POLICY super_admin_manage_admins ON master_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM master_admins ma 
      WHERE ma.user_id = auth.uid() AND ma.is_super_admin = true
    )
  );

-- All master admins can view other master admins
CREATE POLICY master_admin_view_admins ON master_admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM master_admins ma 
      WHERE ma.user_id = auth.uid()
    )
  );

-- Comments for clarity
COMMENT ON TABLE club_payment_history IS 'Tracks billing and payment history for clubs';
COMMENT ON TABLE master_admins IS 'Administrators for the master web dashboard';
COMMENT ON COLUMN clubs.is_access_enabled IS 'Controls whether users from this club can access the app';
COMMENT ON FUNCTION check_club_access IS 'Checks if a user has access based on their club''s payment status'; 