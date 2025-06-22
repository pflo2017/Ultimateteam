-- Consolidate Duplicate Permissive Policies
-- This script addresses warnings about multiple permissive policies for the same role and action
-- by consolidating them into single policies with combined conditions

-- Start transaction for safety
BEGIN;

-- Consolidate multiple permissive policies for activity_attendance table
DROP POLICY IF EXISTS "Activity attendance is viewable by users in the same club" ON public.activity_attendance;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Anyone can view attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Coaches can view attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Everyone can view attendance records" ON public.activity_attendance;
CREATE POLICY "Consolidated attendance view policy" 
ON public.activity_attendance
FOR SELECT
USING (
  TRUE  -- Allow all users to view attendance records
);

-- Consolidate multiple permissive policies for activity_presence table
DROP POLICY IF EXISTS "Enable read access for all users" ON public.activity_presence;
DROP POLICY IF EXISTS "Everyone can read presence" ON public.activity_presence;
CREATE POLICY "Consolidated presence view policy" 
ON public.activity_presence
FOR SELECT
USING (
  TRUE  -- Allow all users to view presence records
);

-- Consolidate multiple permissive policies for clubs table
DROP POLICY IF EXISTS "Clubs are viewable by their admin - optimized" ON public.clubs;
CREATE POLICY "Consolidated clubs view policy" 
ON public.clubs
FOR SELECT
USING (
  admin_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM master_admins
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Consolidate multiple permissive policies for coaches table
DROP POLICY IF EXISTS "Allow select by phone_number" ON public.coaches;
CREATE POLICY "Consolidated coaches view policy" 
ON public.coaches
FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
  OR
  phone_number IS NOT NULL
);

-- Consolidate multiple permissive policies for master_admins table
CREATE POLICY "Consolidated master_admins view policy" 
ON public.master_admins
FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email = 'admin@ultimateteam.com'
  )
);

-- Consolidate multiple permissive policies for monthly_payments table
CREATE POLICY "Consolidated monthly_payments view policy" 
ON public.monthly_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

-- Consolidate multiple permissive policies for parent_children table
DROP POLICY IF EXISTS "Anyone can insert children" ON public.parent_children;
DROP POLICY IF EXISTS "Parents can insert their children" ON public.parent_children;
CREATE POLICY "Consolidated parent_children insert policy" 
ON public.parent_children
FOR INSERT
WITH CHECK (
  TRUE  -- Allow all authenticated users to insert
);

DROP POLICY IF EXISTS "Anyone can view children" ON public.parent_children;
DROP POLICY IF EXISTS "Parents can view their children" ON public.parent_children;
CREATE POLICY "Consolidated parent_children view policy" 
ON public.parent_children
FOR SELECT
USING (
  TRUE  -- Allow all users to view
);

DROP POLICY IF EXISTS "Anyone can update children" ON public.parent_children;
DROP POLICY IF EXISTS "Parents can update their children" ON public.parent_children;
CREATE POLICY "Consolidated parent_children update policy" 
ON public.parent_children
FOR UPDATE
USING (
  TRUE  -- Allow all authenticated users to update
);

-- Consolidate multiple permissive policies for parents table
DROP POLICY IF EXISTS "Allow public read for login" ON public.parents;
DROP POLICY IF EXISTS "Allow public to verify parent accounts" ON public.parents;
DROP POLICY IF EXISTS "Public can verify parents" ON public.parents;
CREATE POLICY "Consolidated parents view policy" 
ON public.parents
FOR SELECT
USING (
  TRUE  -- Allow all users to view parents
);

-- Consolidate multiple permissive policies for players table
DROP POLICY IF EXISTS "Players are deletable by club admin" ON public.players;
DROP POLICY IF EXISTS "Players are deletable by parent or admin" ON public.players;
CREATE POLICY "Consolidated players delete policy" 
ON public.players
FOR DELETE
USING (
  parent_id IN (
    SELECT p.id FROM parents p
    WHERE p.user_id = (SELECT auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow all users to read players" ON public.players;
DROP POLICY IF EXISTS "Allow read for all authenticated users" ON public.players;
DROP POLICY IF EXISTS "Players are viewable by club admin" ON public.players;
DROP POLICY IF EXISTS "Players are viewable by parent or admin" ON public.players;
CREATE POLICY "Consolidated players view policy" 
ON public.players
FOR SELECT
USING (
  TRUE  -- Allow all users to view players
);

DROP POLICY IF EXISTS "Admins and coaches can update payment_status" ON public.players;
DROP POLICY IF EXISTS "Players are updatable by club admin" ON public.players;
DROP POLICY IF EXISTS "Players are updatable by parent or admin" ON public.players;
CREATE POLICY "Consolidated players update policy" 
ON public.players
FOR UPDATE
USING (
  parent_id IN (
    SELECT p.id FROM parents p
    WHERE p.user_id = (SELECT auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
  OR
  team_id IN (
    SELECT t.id FROM teams t
    JOIN coaches c ON t.club_id = c.club_id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

-- Consolidate multiple permissive policies for posts table
DROP POLICY IF EXISTS "Admins can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Coaches can delete their own posts" ON public.posts;
CREATE POLICY "Consolidated posts delete policy" 
ON public.posts
FOR DELETE
USING (
  author_id = (SELECT auth.uid()) AND
  (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE user_id = (SELECT auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM coaches
      WHERE user_id = (SELECT auth.uid())
    )
  )
);

-- Consolidate multiple permissive policies for profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Consolidated profiles view policy" 
ON public.profiles
FOR SELECT
USING (
  id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Consolidate multiple permissive policies for teams table
DROP POLICY IF EXISTS "Teams are deletable by admin" ON public.teams;
DROP POLICY IF EXISTS "Teams are deletable by club admin" ON public.teams;
DROP POLICY IF EXISTS "Users can delete teams for their own club" ON public.teams;
CREATE POLICY "Consolidated teams delete policy" 
ON public.teams
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are insertable by admin" ON public.teams;
DROP POLICY IF EXISTS "Teams are insertable by authenticated admins" ON public.teams;
DROP POLICY IF EXISTS "Teams are insertable by club admin" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams for their own club" ON public.teams;
CREATE POLICY "Consolidated teams insert policy" 
ON public.teams
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow team code verification" ON public.teams;
DROP POLICY IF EXISTS "Teams are viewable by club admin" ON public.teams;
DROP POLICY IF EXISTS "Teams are viewable by users in the same club" ON public.teams;
DROP POLICY IF EXISTS "Users can view teams for their own club" ON public.teams;
CREATE POLICY "Consolidated teams view policy" 
ON public.teams
FOR SELECT
USING (
  TRUE  -- Allow all users to view teams
);

DROP POLICY IF EXISTS "Teams are updatable by admin" ON public.teams;
DROP POLICY IF EXISTS "Teams are updatable by club admin" ON public.teams;
DROP POLICY IF EXISTS "Users can update teams for their own club" ON public.teams;
CREATE POLICY "Consolidated teams update policy" 
ON public.teams
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
  OR
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

-- Commit the transaction if everything went well
COMMIT; 