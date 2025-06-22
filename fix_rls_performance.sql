-- Fix RLS Performance Issues (auth_rls_initplan warnings)
-- This script optimizes row level security policies by replacing direct calls to auth.<function>()
-- with (select auth.<function>()) to prevent re-evaluation for each row

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

DROP POLICY IF EXISTS "Coaches can view all views for their club's posts" ON public.post_views;
CREATE POLICY "Coaches can view all views for their club's posts" 
ON public.post_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM coaches c
    JOIN teams t ON c.id = t.coach_id
    JOIN posts p ON p.team_id = t.id
    WHERE post_id = p.id
    AND c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Admins can view all post views" ON public.post_views;
CREATE POLICY "Admins can view all post views" 
ON public.post_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_profiles
    WHERE user_id = (SELECT auth.uid())
  )
);

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

-- Coaches table
DROP POLICY IF EXISTS "Coaches are viewable by club admin" ON public.coaches;
CREATE POLICY "Coaches are viewable by club admin" 
ON public.coaches
FOR SELECT
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Coach can update their own row" ON public.coaches;
CREATE POLICY "Coach can update their own row" 
ON public.coaches
FOR UPDATE
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

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
)
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
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

DROP POLICY IF EXISTS "Allow coach to claim their row on registration" ON public.coaches;
CREATE POLICY "Allow coach to claim their row on registration" 
ON public.coaches
FOR UPDATE
USING (phone_number = (SELECT phone FROM auth.users WHERE id = (SELECT auth.uid())))
WITH CHECK (phone_number = (SELECT phone FROM auth.users WHERE id = (SELECT auth.uid())));

-- Teams table
DROP POLICY IF EXISTS "Teams are viewable by club admin" ON public.teams;
CREATE POLICY "Teams are viewable by club admin" 
ON public.teams
FOR SELECT
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

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

DROP POLICY IF EXISTS "Users can create teams for their own club" ON public.teams;
CREATE POLICY "Users can create teams for their own club" 
ON public.teams
FOR INSERT
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can view teams for their own club" ON public.teams;
CREATE POLICY "Users can view teams for their own club" 
ON public.teams
FOR SELECT
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update teams for their own club" ON public.teams;
CREATE POLICY "Users can update teams for their own club" 
ON public.teams
FOR UPDATE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete teams for their own club" ON public.teams;
CREATE POLICY "Users can delete teams for their own club" 
ON public.teams
FOR DELETE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
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
)
WITH CHECK (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Teams are deletable by club admin" ON public.teams;
CREATE POLICY "Teams are deletable by club admin" 
ON public.teams
FOR DELETE
USING (
  club_id IN (
    SELECT c.id FROM clubs c WHERE c.admin_id = (SELECT auth.uid())
  )
);

-- Clubs table
DROP POLICY IF EXISTS "Clubs are viewable by their admin" ON public.clubs;
CREATE POLICY "Clubs are viewable by their admin" 
ON public.clubs
FOR SELECT
USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clubs are insertable by any authenticated user" ON public.clubs;
CREATE POLICY "Clubs are insertable by any authenticated user" 
ON public.clubs
FOR INSERT
WITH CHECK ((SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "Clubs are updatable by their admin" ON public.clubs;
CREATE POLICY "Clubs are updatable by their admin" 
ON public.clubs
FOR UPDATE
USING (admin_id = (SELECT auth.uid()))
WITH CHECK (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clubs are deletable by their admin" ON public.clubs;
CREATE POLICY "Clubs are deletable by their admin" 
ON public.clubs
FOR DELETE
USING (admin_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Master admins can update club suspension" ON public.clubs;
CREATE POLICY "Master admins can update club suspension" 
ON public.clubs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Master admins can view all clubs" ON public.clubs;
CREATE POLICY "Master admins can view all clubs" 
ON public.clubs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM master_admins ma
    WHERE ma.user_id = (SELECT auth.uid())
  )
);

-- Add a comment to explain the changes
COMMENT ON TABLE coaches IS 'Coaches table with optimized RLS policies for better performance';
COMMENT ON TABLE teams IS 'Teams table with optimized RLS policies for better performance';
COMMENT ON TABLE clubs IS 'Clubs table with optimized RLS policies for better performance';
COMMENT ON TABLE admin_profiles IS 'Admin profiles table with optimized RLS policies for better performance';
COMMENT ON TABLE post_views IS 'Post views table with optimized RLS policies for better performance'; 