-- Complete RLS Performance Fixes
-- This script addresses all RLS performance warnings by replacing direct calls to auth.<function>()
-- with (SELECT auth.<function>()) to prevent re-evaluation for each row

-- Start transaction for safety
BEGIN;

-- Fix auth_rls_initplan issues for teams table
DROP POLICY IF EXISTS "Teams are deletable by club admin" ON public.teams;
CREATE POLICY "Teams are deletable by club admin" 
ON public.teams
FOR DELETE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are insertable by authenticated admins" ON public.teams;
CREATE POLICY "Teams are insertable by authenticated admins" 
ON public.teams
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are insertable by club admin" ON public.teams;
CREATE POLICY "Teams are insertable by club admin" 
ON public.teams
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are updatable by club admin" ON public.teams;
CREATE POLICY "Teams are updatable by club admin" 
ON public.teams
FOR UPDATE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are viewable by club admin" ON public.teams;
CREATE POLICY "Teams are viewable by club admin" 
ON public.teams
FOR SELECT
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can create teams for their own club" ON public.teams;
CREATE POLICY "Users can create teams for their own club" 
ON public.teams
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete teams for their own club" ON public.teams;
CREATE POLICY "Users can delete teams for their own club" 
ON public.teams
FOR DELETE
USING (
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update teams for their own club" ON public.teams;
CREATE POLICY "Users can update teams for their own club" 
ON public.teams
FOR UPDATE
USING (
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view teams for their own club" ON public.teams;
CREATE POLICY "Users can view teams for their own club" 
ON public.teams
FOR SELECT
USING (
  club_id IN (
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for coaches table
DROP POLICY IF EXISTS "Allow coach to claim their row on registration" ON public.coaches;
CREATE POLICY "Allow coach to claim their row on registration" 
ON public.coaches
FOR UPDATE
USING (
  user_id IS NULL AND
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE email = coaches.email AND id = (SELECT auth.uid())
  )
)
WITH CHECK (
  user_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "Coaches are deletable by club admin" ON public.coaches;
CREATE POLICY "Coaches are deletable by club admin" 
ON public.coaches
FOR DELETE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches are insertable by club admin" ON public.coaches;
CREATE POLICY "Coaches are insertable by club admin" 
ON public.coaches
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches are updatable by club admin" ON public.coaches;
CREATE POLICY "Coaches are updatable by club admin" 
ON public.coaches
FOR UPDATE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches are viewable by club admin" ON public.coaches;
CREATE POLICY "Coaches are viewable by club admin" 
ON public.coaches
FOR SELECT
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for players table
DROP POLICY IF EXISTS "Admins and coaches can update payment_status" ON public.players;
CREATE POLICY "Admins and coaches can update payment_status" 
ON public.players
FOR UPDATE
USING (
  (
    EXISTS (
      SELECT 1 FROM admin_profiles
      WHERE user_id = (SELECT auth.uid())
    )
  ) OR (
    team_id IN (
      SELECT t.id FROM teams t
      JOIN coaches c ON t.club_id = c.club_id
      WHERE c.user_id = (SELECT auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "Allow read for all authenticated users" ON public.players;
CREATE POLICY "Allow read for all authenticated users" 
ON public.players
FOR SELECT
USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Parents can add their own children" ON public.players;
CREATE POLICY "Parents can add their own children" 
ON public.players
FOR INSERT
WITH CHECK (
  parent_id IN (
    SELECT p.id FROM parents p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Players are deletable by club admin" ON public.players;
CREATE POLICY "Players are deletable by club admin" 
ON public.players
FOR DELETE
USING (
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Players are deletable by parent or admin" ON public.players;
CREATE POLICY "Players are deletable by parent or admin" 
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
);

DROP POLICY IF EXISTS "Players are updatable by club admin" ON public.players;
CREATE POLICY "Players are updatable by club admin" 
ON public.players
FOR UPDATE
USING (
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Players are updatable by parent or admin" ON public.players;
CREATE POLICY "Players are updatable by parent or admin" 
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
);

DROP POLICY IF EXISTS "Players are viewable by club admin" ON public.players;
CREATE POLICY "Players are viewable by club admin" 
ON public.players
FOR SELECT
USING (
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for clubs table
DROP POLICY IF EXISTS "Clubs are deletable by their admin" ON public.clubs;
CREATE POLICY "Clubs are deletable by their admin" 
ON public.clubs
FOR DELETE
USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clubs are insertable by admin" ON public.clubs;
CREATE POLICY "Clubs are insertable by admin" 
ON public.clubs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Clubs are insertable by any authenticated user" ON public.clubs;
CREATE POLICY "Clubs are insertable by any authenticated user" 
ON public.clubs
FOR INSERT
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Clubs are updatable by their admin" ON public.clubs;
CREATE POLICY "Clubs are updatable by their admin" 
ON public.clubs
FOR UPDATE
USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clubs are viewable by their admin" ON public.clubs;
CREATE POLICY "Clubs are viewable by their admin" 
ON public.clubs
FOR SELECT
USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Master admins can update club suspension" ON public.clubs;
CREATE POLICY "Master admins can update club suspension" 
ON public.clubs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM master_admins
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Master admins can view all clubs" ON public.clubs;
CREATE POLICY "Master admins can view all clubs" 
ON public.clubs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for parents table
DROP POLICY IF EXISTS "Parents can update own data" ON public.parents;
CREATE POLICY "Parents can update own data" 
ON public.parents
FOR UPDATE
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Parents can view own data" ON public.parents;
CREATE POLICY "Parents can view own data" 
ON public.parents
FOR SELECT
USING (user_id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for activities table
DROP POLICY IF EXISTS "Coaches can manage team activities" ON public.activities;
CREATE POLICY "Coaches can manage team activities" 
ON public.activities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for activity_rsvps table
DROP POLICY IF EXISTS "activity_rsvps_insert_policy" ON public.activity_rsvps;
CREATE POLICY "activity_rsvps_insert_policy" 
ON public.activity_rsvps
FOR INSERT
WITH CHECK (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "activity_rsvps_update_policy" ON public.activity_rsvps;
CREATE POLICY "activity_rsvps_update_policy" 
ON public.activity_rsvps
FOR UPDATE
USING (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for activity_presence table
DROP POLICY IF EXISTS "Parents can delete presence" ON public.activity_presence;
CREATE POLICY "Parents can delete presence" 
ON public.activity_presence
FOR DELETE
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Parents can delete their child's presence" ON public.activity_presence;
CREATE POLICY "Parents can delete their child's presence" 
ON public.activity_presence
FOR DELETE
USING (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Parents can insert presence" ON public.activity_presence;
CREATE POLICY "Parents can insert presence" 
ON public.activity_presence
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Parents can insert their child's presence" ON public.activity_presence;
CREATE POLICY "Parents can insert their child's presence" 
ON public.activity_presence
FOR INSERT
WITH CHECK (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Parents can update presence" ON public.activity_presence;
CREATE POLICY "Parents can update presence" 
ON public.activity_presence
FOR UPDATE
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Parents can update their child's presence" ON public.activity_presence;
CREATE POLICY "Parents can update their child's presence" 
ON public.activity_presence
FOR UPDATE
USING (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Parents can update their own presence" ON public.activity_presence;
CREATE POLICY "Parents can update their own presence" 
ON public.activity_presence
FOR UPDATE
USING (user_id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for activity_attendance table
DROP POLICY IF EXISTS "Admins can manage all attendance records" ON public.activity_attendance;
CREATE POLICY "Admins can manage all attendance records" 
ON public.activity_attendance
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can view all attendance" ON public.activity_attendance;
CREATE POLICY "Admins can view all attendance" 
ON public.activity_attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can delete attendance" ON public.activity_attendance;
CREATE POLICY "Coaches can delete attendance" 
ON public.activity_attendance
FOR DELETE
USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can manage attendance for their team's activities" ON public.activity_attendance;
CREATE POLICY "Coaches can manage attendance for their team's activities" 
ON public.activity_attendance
FOR ALL
USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can record attendance" ON public.activity_attendance;
CREATE POLICY "Coaches can record attendance" 
ON public.activity_attendance
FOR INSERT
WITH CHECK (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can update their attendance records" ON public.activity_attendance;
CREATE POLICY "Coaches can update their attendance records" 
ON public.activity_attendance
FOR UPDATE
USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can view attendance" ON public.activity_attendance;
CREATE POLICY "Coaches can view attendance" 
ON public.activity_attendance
FOR SELECT
USING (
  activity_id IN (
    SELECT a.id FROM activities a
    JOIN teams t ON a.team_id = t.id
    JOIN coaches c ON t.coach_id = c.id
    WHERE c.user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for posts table
DROP POLICY IF EXISTS "Admins and coaches can insert their own posts" ON public.posts;
CREATE POLICY "Admins and coaches can insert their own posts" 
ON public.posts
FOR INSERT
WITH CHECK (
  author_id = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "Admins can delete their own posts" ON public.posts;
CREATE POLICY "Admins can delete their own posts" 
ON public.posts
FOR DELETE
USING (
  author_id = (SELECT auth.uid()) AND
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can delete their own posts" ON public.posts;
CREATE POLICY "Coaches can delete their own posts" 
ON public.posts
FOR DELETE
USING (
  author_id = (SELECT auth.uid()) AND
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for post_teams table
DROP POLICY IF EXISTS "Admins and coaches can insert post_teams" ON public.post_teams;
CREATE POLICY "Admins and coaches can insert post_teams" 
ON public.post_teams
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM posts p
    WHERE p.id = post_teams.post_id AND p.author_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for post_comments table
DROP POLICY IF EXISTS "Anyone can create comments" ON public.post_comments;
CREATE POLICY "Anyone can create comments" 
ON public.post_comments
FOR INSERT
WITH CHECK (author_id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for monthly_payments table
DROP POLICY IF EXISTS "Coaches can insert monthly payments" ON public.monthly_payments;
CREATE POLICY "Coaches can insert monthly payments" 
ON public.monthly_payments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coaches can update monthly payments" ON public.monthly_payments;
CREATE POLICY "Coaches can update monthly payments" 
ON public.monthly_payments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "admin_view_payments" ON public.monthly_payments;
CREATE POLICY "admin_view_payments" 
ON public.monthly_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "coach_view_payments" ON public.monthly_payments;
CREATE POLICY "coach_view_payments" 
ON public.monthly_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "parent_read_payments" ON public.monthly_payments;
CREATE POLICY "parent_read_payments" 
ON public.monthly_payments
FOR SELECT
USING (
  player_id IN (
    SELECT p.id FROM players p
    JOIN parents pa ON p.parent_id = pa.id
    WHERE pa.user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for master_admins table
DROP POLICY IF EXISTS "Super admins can manage master_admins" ON public.master_admins;
CREATE POLICY "Super admins can manage master_admins" 
ON public.master_admins
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email = 'admin@ultimateteam.com'
  )
);

DROP POLICY IF EXISTS "Users can see their own master_admin record" ON public.master_admins;
CREATE POLICY "Users can see their own master_admin record" 
ON public.master_admins
FOR SELECT
USING (user_id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for notifications table
DROP POLICY IF EXISTS "Allow admins and coaches to insert notifications" ON public.notifications;
CREATE POLICY "Allow admins and coaches to insert notifications" 
ON public.notifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Allow recipients to read their own notifications" ON public.notifications;
CREATE POLICY "Allow recipients to read their own notifications" 
ON public.notifications
FOR SELECT
USING (recipient_id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for payment_reminder_logs table
DROP POLICY IF EXISTS "Allow admins and coaches to insert payment reminder logs" ON public.payment_reminder_logs;
CREATE POLICY "Allow admins and coaches to insert payment reminder logs" 
ON public.payment_reminder_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM coaches
    WHERE user_id = (SELECT auth.uid())
  ) OR
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Fix auth_rls_initplan issues for profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles
FOR UPDATE
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles
FOR SELECT
USING (id = (SELECT auth.uid()));

-- Fix auth_rls_initplan issues for players_backup table
DROP POLICY IF EXISTS "Only super admins can access players_backup" ON public.players_backup;
CREATE POLICY "Only super admins can access players_backup" 
ON public.players_backup
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email = 'admin@ultimateteam.com'
  )
);

-- Fix auth_rls_initplan issues for players_payment_backup table
DROP POLICY IF EXISTS "Only super admins can access players_payment_backup" ON public.players_payment_backup;
CREATE POLICY "Only super admins can access players_payment_backup" 
ON public.players_payment_backup
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = (SELECT auth.uid()) AND email = 'admin@ultimateteam.com'
  )
);

-- Consolidate multiple permissive policies for activities table
DROP POLICY IF EXISTS "Allow activities with team_id" ON public.activities;
DROP POLICY IF EXISTS "Activities are viewable by users in the same club" ON public.activities;
CREATE POLICY "Consolidated activities policy" 
ON public.activities
FOR ALL
USING (
  team_id IS NOT NULL 
  OR 
  EXISTS (
    SELECT 1 FROM teams t
    JOIN coaches c ON t.coach_id = c.id
    WHERE t.id = activities.team_id
    AND c.user_id = (SELECT auth.uid())
  )
  OR
  team_id IN (
    SELECT t.id FROM teams t
    JOIN clubs c ON t.club_id = c.id
    WHERE c.admin_id = (SELECT auth.uid())
  )
);

-- Commit the transaction if everything went well
COMMIT; 