-- Create a view to access auth.sessions data safely
CREATE OR REPLACE VIEW auth_sessions WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  factor_id,
  aal
FROM auth.sessions;

-- Grant SELECT access to authenticated users
GRANT SELECT ON auth_sessions TO authenticated;

-- Add policy to only allow master admins to view all sessions
CREATE POLICY "Master admins can view all sessions" 
  ON auth_sessions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM master_admins 
    WHERE user_id = auth.uid()
  ));

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions" 
  ON auth_sessions FOR SELECT 
  USING (user_id = auth.uid());

COMMENT ON VIEW auth_sessions IS 'Safe view of auth.sessions data for application use'; 