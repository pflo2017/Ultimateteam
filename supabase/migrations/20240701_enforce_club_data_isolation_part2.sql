-- Migration to enforce proper data isolation between clubs
-- This ensures all data queries are properly filtered by club_id
-- to prevent data leakage between different clubs

-- Add club_id indexes where missing
CREATE INDEX IF NOT EXISTS players_club_id_idx ON players(club_id);
CREATE INDEX IF NOT EXISTS monthly_payments_player_club_idx ON monthly_payments(player_id);
CREATE INDEX IF NOT EXISTS activities_club_id_idx ON activities(club_id);
CREATE INDEX IF NOT EXISTS teams_club_id_idx ON teams(club_id);

-- Update monthly_payments RLS policies
DROP POLICY IF EXISTS admin_read_payments ON monthly_payments;
CREATE POLICY admin_read_payments ON monthly_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN clubs c ON p.club_id = c.id
      WHERE p.id = monthly_payments.player_id
      AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_update_payments ON monthly_payments;
CREATE POLICY admin_update_payments ON monthly_payments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN clubs c ON p.club_id = c.id
      WHERE p.id = monthly_payments.player_id
      AND c.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN clubs c ON p.club_id = c.id
      WHERE p.id = monthly_payments.player_id
      AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS admin_insert_payments ON monthly_payments;
CREATE POLICY admin_insert_payments ON monthly_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players p
      JOIN clubs c ON p.club_id = c.id
      WHERE p.id = monthly_payments.player_id
      AND c.admin_id = auth.uid()
    )
  );

-- Update activities RLS policies
DROP POLICY IF EXISTS admin_access_activities ON activities;
CREATE POLICY admin_access_activities ON activities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = activities.club_id
      AND clubs.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clubs
      WHERE clubs.id = activities.club_id
      AND clubs.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coach_read_activities ON activities;
CREATE POLICY coach_read_activities ON activities
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_coaches tc
      JOIN teams t ON tc.team_id = t.id
      WHERE t.id = activities.team_id
      AND t.club_id = activities.club_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Update player_status_history RLS policies
DROP POLICY IF EXISTS admin_read_player_history ON player_status_history;
CREATE POLICY admin_read_player_history ON player_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN clubs c ON p.club_id = c.id
      WHERE p.id = player_status_history.player_id
      AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coach_read_player_history ON player_status_history;
CREATE POLICY coach_read_player_history ON player_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      JOIN teams t ON p.team_id = t.id
      JOIN team_coaches tc ON t.id = tc.team_id
      WHERE p.id = player_status_history.player_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Update activity_attendance RLS policies
DROP POLICY IF EXISTS admin_access_attendance ON activity_attendance;
CREATE POLICY admin_access_attendance ON activity_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN clubs c ON a.club_id = c.id
      WHERE a.id = activity_attendance.activity_id
      AND c.admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN clubs c ON a.club_id = c.id
      WHERE a.id = activity_attendance.activity_id
      AND c.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS coach_read_attendance ON activity_attendance;
CREATE POLICY coach_read_attendance ON activity_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN teams t ON a.team_id = t.id
      JOIN team_coaches tc ON t.id = tc.team_id
      WHERE a.id = activity_attendance.activity_id
      AND tc.coach_id = auth.uid()
    )
  );

-- Update database functions to enforce club_id filtering

-- Function to ensure a player belongs to the admin's club
CREATE OR REPLACE FUNCTION is_player_in_admin_club(player_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players p
    JOIN clubs c ON p.club_id = c.id
    WHERE p.id = player_id
    AND c.admin_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure a player belongs to the coach's teams
CREATE OR REPLACE FUNCTION is_player_in_coach_teams(player_id UUID) 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players p
    JOIN teams t ON p.team_id = t.id
    JOIN team_coaches tc ON t.id = tc.team_id
    WHERE p.id = player_id
    AND tc.coach_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create log trigger to help monitor and debug access attempts
CREATE OR REPLACE FUNCTION log_access_attempt()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO access_logs (
    user_id,
    table_name,
    operation,
    record_id,
    timestamp
  ) VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    NEW.id,
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create access_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  table_name TEXT,
  operation TEXT,
  record_id UUID,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Add trigger to key tables
DROP TRIGGER IF EXISTS log_players_access ON players;
CREATE TRIGGER log_players_access
  BEFORE INSERT OR UPDATE
  ON players
  FOR EACH ROW
  EXECUTE FUNCTION log_access_attempt();

DROP TRIGGER IF EXISTS log_monthly_payments_access ON monthly_payments;
CREATE TRIGGER log_monthly_payments_access
  BEFORE INSERT OR UPDATE
  ON monthly_payments
  FOR EACH ROW
  EXECUTE FUNCTION log_access_attempt(); 