-- Fix SECURITY DEFINER views mentioned in Supabase advisor warnings
-- These views are using SECURITY DEFINER which causes RLS policies to be bypassed

-- First drop the existing views
DROP VIEW IF EXISTS player_payment_history;
DROP VIEW IF EXISTS parent_payment_history;
DROP VIEW IF EXISTS player_training_attendance;

-- Now recreate them with security_invoker=true

-- 1. Create player_payment_history with security_invoker
CREATE VIEW player_payment_history
WITH (security_invoker = true)
AS
SELECT 
    mp.id,
    mp.player_id,
    mp.year,
    mp.month,
    mp.status,
    mp.updated_at,
    p.name as player_name,
    t.name as team_name
FROM 
    monthly_payments mp
JOIN 
    players p ON mp.player_id = p.id
LEFT JOIN
    teams t ON p.team_id = t.id;

-- 2. Create parent_payment_history with security_invoker
CREATE VIEW parent_payment_history
WITH (security_invoker = true)
AS
SELECT 
    mp.id,
    mp.player_id,
    mp.year,
    mp.month,
    mp.status,
    mp.updated_at,
    p.name as player_name,
    t.name as team_name
FROM 
    monthly_payments mp
JOIN 
    players p ON mp.player_id = p.id
LEFT JOIN 
    teams t ON p.team_id = t.id
WHERE 
    p.parent_id = auth.uid();

-- 3. Create player_training_attendance with security_invoker
-- Using a simplified version to avoid type casting issues
CREATE VIEW player_training_attendance
WITH (security_invoker = true)
AS
SELECT
    a.*,
    p.name as player_name
FROM
    activity_attendance a
JOIN
    players p ON a.player_id = p.id;

-- Add explicit RLS policy for parents to access monthly_payments
DROP POLICY IF EXISTS parent_read_payments ON monthly_payments;

CREATE POLICY parent_read_payments ON monthly_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = monthly_payments.player_id
      AND p.parent_id = auth.uid()
    )
  );

-- Force reload of RLS policies
NOTIFY pgrst, 'reload config'; 