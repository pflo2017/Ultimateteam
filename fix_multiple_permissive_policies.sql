-- Fix Multiple Permissive Policies Issues
-- This script consolidates multiple permissive policies for the same role and action
-- to improve database performance

-- Activities table
-- Consolidate DELETE policies
DROP POLICY IF EXISTS "Allow activities with team_id" ON public.activities;
DROP POLICY IF EXISTS "Coaches can manage team activities" ON public.activities;
CREATE POLICY "Coaches can manage team activities and activities with team_id" 
ON public.activities
FOR DELETE
USING (
  -- Combined condition
  team_id IS NOT NULL 
  OR 
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
);

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Allow activities with team_id" ON public.activities FOR INSERT;
DROP POLICY IF EXISTS "Coaches can manage team activities" ON public.activities FOR INSERT;
CREATE POLICY "Coaches can manage team activities and activities with team_id" 
ON public.activities
FOR INSERT
WITH CHECK (
  -- Combined condition
  team_id IS NOT NULL
  OR
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
);

-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Activities are viewable by users in the same club" ON public.activities;
DROP POLICY IF EXISTS "Allow activities with team_id" ON public.activities FOR SELECT;
DROP POLICY IF EXISTS "Coaches can manage team activities" ON public.activities FOR SELECT;
CREATE POLICY "Activities access policy" 
ON public.activities
FOR SELECT
USING (
  -- Combined conditions from all three policies
  team_id IS NOT NULL
  OR
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM teams t
    WHERE t.id = activities.team_id
    AND t.club_id IN (
      -- User's club as admin
      SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
      UNION
      -- User's club as coach
      SELECT co.club_id FROM coaches co WHERE co.user_id = (SELECT auth.uid())
    )
  )
);

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Allow activities with team_id" ON public.activities FOR UPDATE;
DROP POLICY IF EXISTS "Coaches can manage team activities" ON public.activities FOR UPDATE;
CREATE POLICY "Coaches can manage team activities and activities with team_id" 
ON public.activities
FOR UPDATE
USING (
  -- Combined condition
  team_id IS NOT NULL
  OR
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  -- Combined condition
  team_id IS NOT NULL
  OR
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
);

-- Activity attendance table
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Activity attendance is viewable by users in the same club" ON public.activity_attendance;
DROP POLICY IF EXISTS "Admins can manage all attendance records" ON public.activity_attendance FOR SELECT;
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Anyone can view attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Coaches can manage attendance for their team's activities" ON public.activity_attendance FOR SELECT;
DROP POLICY IF EXISTS "Coaches can view attendance" ON public.activity_attendance;
DROP POLICY IF EXISTS "Everyone can view attendance records" ON public.activity_attendance;
CREATE POLICY "Comprehensive attendance viewing policy" 
ON public.activity_attendance
FOR SELECT
USING (
  -- Admin condition
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
  OR
  -- Coach condition for their team
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE a.id = activity_attendance.activity_id
    AND c.user_id = (SELECT auth.uid())
  )
  OR
  -- Same club condition
  EXISTS (
    SELECT 1 FROM activities a
    JOIN teams t ON a.team_id = t.id
    WHERE a.id = activity_attendance.activity_id
    AND t.club_id IN (
      -- User's club as admin
      SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
      UNION
      -- User's club as coach
      SELECT co.club_id FROM coaches co WHERE co.user_id = (SELECT auth.uid())
    )
  )
  OR
  -- Public viewing
  true
);

-- Activity presence table
-- Consolidate DELETE policies
DROP POLICY IF EXISTS "Parents can delete presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can delete their child's presence" ON public.activity_presence;
CREATE POLICY "Parents can delete presence records" 
ON public.activity_presence
FOR DELETE
USING (
  -- Combined condition
  parent_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN parents p ON pc.parent_id = p.id
    WHERE pc.player_id = activity_presence.player_id
    AND p.user_id = (SELECT auth.uid())
  )
);

-- Consolidate INSERT policies
DROP POLICY IF EXISTS "Parents can insert presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can insert their child's presence" ON public.activity_presence;
CREATE POLICY "Parents can insert presence records" 
ON public.activity_presence
FOR INSERT
WITH CHECK (
  -- Combined condition
  parent_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN parents p ON pc.parent_id = p.id
    WHERE pc.player_id = activity_presence.player_id
    AND p.user_id = (SELECT auth.uid())
  )
);

-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.activity_presence;
DROP POLICY IF EXISTS "Everyone can read presence" ON public.activity_presence;
CREATE POLICY "Public activity presence view policy" 
ON public.activity_presence
FOR SELECT
USING (true);

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Parents can update presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can update their child's presence" ON public.activity_presence;
DROP POLICY IF EXISTS "Parents can update their own presence" ON public.activity_presence;
CREATE POLICY "Parents can update presence records" 
ON public.activity_presence
FOR UPDATE
USING (
  -- Combined condition
  parent_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN parents p ON pc.parent_id = p.id
    WHERE pc.player_id = activity_presence.player_id
    AND p.user_id = (SELECT auth.uid())
  )
  OR
  user_id = (SELECT auth.uid())
)
WITH CHECK (
  -- Combined condition
  parent_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM parent_children pc
    JOIN parents p ON pc.parent_id = p.id
    WHERE pc.player_id = activity_presence.player_id
    AND p.user_id = (SELECT auth.uid())
  )
  OR
  user_id = (SELECT auth.uid())
);

-- Clubs table
-- Consolidate SELECT policies
DROP POLICY IF EXISTS "Clubs are viewable by their admin" ON public.clubs;
DROP POLICY IF EXISTS "Master admins can view all clubs" ON public.clubs;
CREATE POLICY "Clubs viewing policy" 
ON public.clubs
FOR SELECT
USING (
  -- Combined condition
  admin_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
);

-- Consolidate UPDATE policies
DROP POLICY IF EXISTS "Clubs are updatable by their admin" ON public.clubs;
DROP POLICY IF EXISTS "Master admins can update club suspension" ON public.clubs;
CREATE POLICY "Clubs update policy" 
ON public.clubs
FOR UPDATE
USING (
  -- Combined condition
  admin_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  -- Combined condition
  admin_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
);

-- Remove duplicate index on admin_profiles table
DROP INDEX IF EXISTS admin_profiles_user_id_idx;

-- Add comments to explain the changes
COMMENT ON TABLE activities IS 'Activities table with consolidated RLS policies for better performance';
COMMENT ON TABLE activity_attendance IS 'Activity attendance table with consolidated RLS policies for better performance';
COMMENT ON TABLE activity_presence IS 'Activity presence table with consolidated RLS policies for better performance';
COMMENT ON TABLE clubs IS 'Clubs table with consolidated RLS policies for better performance';
COMMENT ON TABLE admin_profiles IS 'Admin profiles table with duplicate index removed for better performance'; 