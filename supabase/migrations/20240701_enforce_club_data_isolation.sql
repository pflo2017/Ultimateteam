-- CRITICAL DATA ISOLATION FIX
-- This migration ensures proper data isolation between clubs by adding club_id to all relevant tables
-- and creating appropriate constraints and policies

-- ==========================================
-- ACTIVITIES TABLE
-- ==========================================
-- Add club_id to activities table if it doesn't exist
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in activities based on team relationship
UPDATE activities a
SET club_id = t.club_id
FROM teams t
WHERE a.team_id = t.id AND a.club_id IS NULL;

-- For activities without a team, set club_id based on creator's admin profile
UPDATE activities a
SET club_id = c.id
FROM admin_profiles ap
JOIN clubs c ON ap.user_id = c.admin_id
WHERE a.club_id IS NULL AND a.created_by = ap.user_id;

-- For activities without a team and not created by admin, set club_id based on coach's club
UPDATE activities a
SET club_id = c.club_id
FROM coach_profiles cp
JOIN coaches c ON cp.user_id = c.id
WHERE a.club_id IS NULL AND a.created_by = cp.user_id;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE activities
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- ACTIVITY_ATTENDANCE TABLE
-- ==========================================
-- Add club_id to activity_attendance table
ALTER TABLE activity_attendance 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in activity_attendance based on activity relationship
UPDATE activity_attendance aa
SET club_id = a.club_id
FROM activities a
WHERE aa.activity_id = a.id AND aa.club_id IS NULL;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE activity_attendance
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- ACTIVITY_PRESENCE TABLE (RSVPs)
-- ==========================================
-- Add club_id to activity_presence table
ALTER TABLE activity_presence 
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in activity_presence based on activity relationship
UPDATE activity_presence ap
SET club_id = a.club_id
FROM activities a
WHERE ap.activity_id = a.id AND ap.club_id IS NULL;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE activity_presence
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- TEAMS TABLE
-- ==========================================
-- Ensure teams table has club_id and it's NOT NULL
ALTER TABLE teams
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- PLAYERS TABLE
-- ==========================================
-- Ensure players table has club_id
ALTER TABLE players
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in players based on team relationship
UPDATE players p
SET club_id = t.club_id
FROM teams t
WHERE p.team_id = t.id AND p.club_id IS NULL;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE players
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- COACHES TABLE
-- ==========================================
-- Ensure coaches table has club_id
ALTER TABLE coaches
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Make club_id NOT NULL
ALTER TABLE coaches
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- MONTHLY_PAYMENTS TABLE
-- ==========================================
-- Add club_id to monthly_payments table
ALTER TABLE monthly_payments
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in monthly_payments based on player relationship
UPDATE monthly_payments mp
SET club_id = p.club_id
FROM players p
WHERE mp.player_id = p.id AND mp.club_id IS NULL;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE monthly_payments
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- PAYMENT_COLLECTIONS TABLE
-- ==========================================
-- Add club_id to payment_collections table
ALTER TABLE payment_collections
ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Set club_id in payment_collections based on player relationship
UPDATE payment_collections pc
SET club_id = p.club_id
FROM players p
WHERE pc.player_id = p.id AND pc.club_id IS NULL;

-- Make club_id NOT NULL after we've populated it
ALTER TABLE payment_collections
ALTER COLUMN club_id SET NOT NULL;

-- ==========================================
-- INDEXES FOR PERFORMANCE
-- ==========================================
-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS activities_club_id_idx ON activities(club_id);
CREATE INDEX IF NOT EXISTS activity_attendance_club_id_idx ON activity_attendance(club_id);
CREATE INDEX IF NOT EXISTS activity_presence_club_id_idx ON activity_presence(club_id);
CREATE INDEX IF NOT EXISTS teams_club_id_idx ON teams(club_id);
CREATE INDEX IF NOT EXISTS players_club_id_idx ON players(club_id);
CREATE INDEX IF NOT EXISTS coaches_club_id_idx ON coaches(club_id);
CREATE INDEX IF NOT EXISTS monthly_payments_club_id_idx ON monthly_payments(club_id);
CREATE INDEX IF NOT EXISTS payment_collections_club_id_idx ON payment_collections(club_id);

-- ==========================================
-- TRIGGERS FOR NEW RECORDS
-- ==========================================
-- Create a function to set club_id on new activities based on team_id or user role
CREATE OR REPLACE FUNCTION set_activity_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If team_id is provided, get club_id from team
  IF NEW.team_id IS NOT NULL THEN
    SELECT club_id INTO NEW.club_id
    FROM teams
    WHERE id = NEW.team_id;
  END IF;
  
  -- If still no club_id and created by admin, get club_id from admin
  IF NEW.club_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT c.id INTO NEW.club_id
    FROM clubs c
    WHERE c.admin_id = NEW.created_by
    LIMIT 1;
  END IF;
  
  -- If still no club_id and created by coach, get coach's club_id
  IF NEW.club_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT c.club_id INTO NEW.club_id
    FROM coaches c
    JOIN coach_profiles cp ON c.id = cp.coach_id
    WHERE cp.user_id = NEW.created_by
    LIMIT 1;
  END IF;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new activity';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new activities
DROP TRIGGER IF EXISTS set_activity_club_id_trigger ON activities;
CREATE TRIGGER set_activity_club_id_trigger
BEFORE INSERT ON activities
FOR EACH ROW
EXECUTE FUNCTION set_activity_club_id();

-- Create a function to set club_id on new attendance records
CREATE OR REPLACE FUNCTION set_attendance_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get club_id from activity
  SELECT club_id INTO NEW.club_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new attendance record';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new attendance records
DROP TRIGGER IF EXISTS set_attendance_club_id_trigger ON activity_attendance;
CREATE TRIGGER set_attendance_club_id_trigger
BEFORE INSERT ON activity_attendance
FOR EACH ROW
EXECUTE FUNCTION set_attendance_club_id();

-- Create a function to set club_id on new presence records
CREATE OR REPLACE FUNCTION set_presence_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get club_id from activity
  SELECT club_id INTO NEW.club_id
  FROM activities
  WHERE id = NEW.activity_id;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new presence record';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new presence records
DROP TRIGGER IF EXISTS set_presence_club_id_trigger ON activity_presence;
CREATE TRIGGER set_presence_club_id_trigger
BEFORE INSERT ON activity_presence
FOR EACH ROW
EXECUTE FUNCTION set_presence_club_id();

-- Create a function to set club_id on new monthly_payments records
CREATE OR REPLACE FUNCTION set_payment_club_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get club_id from player
  SELECT club_id INTO NEW.club_id
  FROM players
  WHERE id = NEW.player_id;
  
  -- Ensure club_id is set
  IF NEW.club_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine club_id for new payment record';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set club_id on new payment records
DROP TRIGGER IF EXISTS set_payment_club_id_trigger ON monthly_payments;
CREATE TRIGGER set_payment_club_id_trigger
BEFORE INSERT ON monthly_payments
FOR EACH ROW
EXECUTE FUNCTION set_payment_club_id();

-- ==========================================
-- RLS POLICIES
-- ==========================================
-- Update RLS policies for activities to include club-level checks
DROP POLICY IF EXISTS "Activities are viewable by users in the same club" ON activities;
CREATE POLICY "Activities are viewable by users in the same club" 
ON activities
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c JOIN coach_profiles cp ON c.id = cp.coach_id WHERE cp.user_id = auth.uid()
  )
);

-- Update RLS policies for activity_attendance
DROP POLICY IF EXISTS "Activity attendance is viewable by users in the same club" ON activity_attendance;
CREATE POLICY "Activity attendance is viewable by users in the same club" 
ON activity_attendance
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c JOIN coach_profiles cp ON c.id = cp.coach_id WHERE cp.user_id = auth.uid()
  )
);

-- Update RLS policies for teams
DROP POLICY IF EXISTS "Teams are viewable by users in the same club" ON teams;
CREATE POLICY "Teams are viewable by users in the same club" 
ON teams
FOR SELECT
USING (
  -- Direct club_id check for better performance and reliability
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c WHERE c.user_id = auth.uid()
  )
);

-- Update RLS policies for players
DROP POLICY IF EXISTS "Players are viewable by users in the same club" ON players;
CREATE POLICY "Players are viewable by users in the same club" 
ON players
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c JOIN coach_profiles cp ON c.id = cp.coach_id WHERE cp.user_id = auth.uid()
  )
);

-- Update RLS policies for monthly_payments
DROP POLICY IF EXISTS "Payments are viewable by users in the same club" ON monthly_payments;
CREATE POLICY "Payments are viewable by users in the same club" 
ON monthly_payments
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c JOIN coach_profiles cp ON c.id = cp.coach_id WHERE cp.user_id = auth.uid()
  )
);

-- Update RLS policies for payment_collections
DROP POLICY IF EXISTS "Payment collections are viewable by users in the same club" ON payment_collections;
CREATE POLICY "Payment collections are viewable by users in the same club" 
ON payment_collections
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = auth.uid()
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c JOIN coach_profiles cp ON c.id = cp.coach_id WHERE cp.user_id = auth.uid()
  )
);

-- Similar INSERT/UPDATE/DELETE policies should be created for each table
-- to ensure complete data isolation 