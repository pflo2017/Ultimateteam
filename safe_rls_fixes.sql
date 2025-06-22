-- SAFE RLS PERFORMANCE FIXES
-- This script ONLY optimizes RLS policies without touching indexes or constraints

-- Start transaction for safety
BEGIN;

-- Fix RLS Performance Issues (auth_rls_initplan warnings)
-- This optimizes row level security policies by replacing direct calls to auth.<function>()
-- with (SELECT auth.<function>()) to prevent re-evaluation for each row

-- Post views table
DROP POLICY IF EXISTS "Users can view their own post views" ON public.post_views;
CREATE POLICY "Users can view their own post views" 
ON public.post_views
FOR SELECT
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own post views" ON public.post_views;
CREATE POLICY "Users can insert their own post views" 
ON public.post_views
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

-- Admin profiles table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.admin_profiles;
CREATE POLICY "Users can view their own profile" 
ON public.admin_profiles
FOR SELECT
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.admin_profiles;
CREATE POLICY "Users can update their own profile" 
ON public.admin_profiles
FOR UPDATE
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own profile" ON public.admin_profiles;
CREATE POLICY "Users can create their own profile" 
ON public.admin_profiles
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

-- Teams table
DROP POLICY IF EXISTS "Teams are viewable by users in the same club" ON public.teams;
CREATE POLICY "Teams are viewable by users in the same club" 
ON public.teams
FOR SELECT
USING (
  club_id IN (
    -- Admin's club
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
    UNION
    -- Coach's club
    SELECT c.club_id FROM coaches c WHERE c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are deletable by admin" ON public.teams;
CREATE POLICY "Teams are deletable by admin" 
ON public.teams
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are insertable by admin" ON public.teams;
CREATE POLICY "Teams are insertable by admin" 
ON public.teams
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are updatable by admin" ON public.teams;
CREATE POLICY "Teams are updatable by admin" 
ON public.teams
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

-- Coaches table
DROP POLICY IF EXISTS "Coaches can view their own profile" ON public.coaches;
CREATE POLICY "Coaches can view their own profile" 
ON public.coaches
FOR SELECT
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Coach can update their own row" ON public.coaches;
CREATE POLICY "Coach can update their own row" 
ON public.coaches
FOR UPDATE
USING (user_id = (SELECT auth.uid()));

-- Players table
DROP POLICY IF EXISTS "Players are viewable by parent or admin" ON public.players;
CREATE POLICY "Players are viewable by parent or admin" 
ON public.players
FOR SELECT
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

-- Clubs table - careful with this one, using a different name to avoid conflicts
DROP POLICY IF EXISTS "Clubs are viewable by their admin - optimized" ON public.clubs;
CREATE POLICY "Clubs are viewable by their admin - optimized" 
ON public.clubs
FOR SELECT
USING (admin_id = (SELECT auth.uid()));

-- Commit the transaction if everything went well
COMMIT; 