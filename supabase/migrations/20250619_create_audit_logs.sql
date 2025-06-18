-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  club_id UUID REFERENCES clubs(id),
  details JSONB DEFAULT '{}'::jsonb
);

-- Add RLS policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow master admins to view all audit logs
CREATE POLICY "Master admins can view all audit logs" ON public.audit_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = auth.uid()
  )
);

-- Create function to log activities
CREATE OR REPLACE FUNCTION log_activity(
  p_action TEXT,
  p_user_id UUID,
  p_club_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (action, user_id, club_id, details)
  VALUES (p_action, p_user_id, p_club_id, p_details)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get recent activities for dashboard
CREATE OR REPLACE FUNCTION get_recent_activities()
RETURNS TABLE (
  id UUID,
  action TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  club_id UUID,
  club_name TEXT,
  user_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    al.id,
    al.action,
    al.created_at,
    al.user_id,
    al.club_id,
    c.name AS club_name,
    COALESCE(
      (SELECT full_name FROM profiles WHERE id = al.user_id),
      'Unknown User'
    ) AS user_name
  FROM 
    audit_logs al
  LEFT JOIN 
    clubs c ON c.id = al.club_id
  ORDER BY 
    al.created_at DESC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 