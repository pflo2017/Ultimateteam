-- Create posts table
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_general BOOLEAN DEFAULT FALSE, -- True if the post is for all teams
    is_active BOOLEAN DEFAULT TRUE,
    club_id UUID REFERENCES public.clubs(id)
);

-- Create post_teams table (for team-specific posts)
CREATE TABLE public.post_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, team_id)
);

-- Create comments table
CREATE TABLE public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create post reactions table (for likes/reactions)
CREATE TABLE public.post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies for posts
-- 1. Admin can do anything
CREATE POLICY "Admins can do anything with posts"
ON public.posts
USING (
    EXISTS (
        SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
    )
);

-- 2. Coaches can read all posts and create posts
CREATE POLICY "Coaches can read all posts"
ON public.posts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.coaches WHERE coaches.user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can create posts"
ON public.posts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.coaches WHERE coaches.user_id = auth.uid()
    )
);

-- 3. Coaches can update/delete their own posts
CREATE POLICY "Coaches can update their own posts"
ON public.posts
FOR UPDATE
USING (
    author_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.coaches WHERE coaches.user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can delete their own posts"
ON public.posts
FOR DELETE
USING (
    author_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.coaches WHERE coaches.user_id = auth.uid()
    )
);

-- 4. Parents can read posts that are either general or specific to their children's teams
CREATE POLICY "Parents can read relevant posts"
ON public.posts
FOR SELECT
USING (
    is_general = true OR 
    EXISTS (
        SELECT 1 FROM public.players p
        JOIN public.post_teams pt ON p.team_id = pt.team_id
        WHERE p.parent_id = auth.uid() AND pt.post_id = posts.id
    )
);

-- Policies for post_teams
CREATE POLICY "Admins can do anything with post_teams"
ON public.post_teams
USING (
    EXISTS (
        SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
    )
);

CREATE POLICY "Coaches can manage post_teams for their teams"
ON public.post_teams
USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.coaches c ON t.coach_id = c.id
        WHERE t.id = post_teams.team_id AND c.user_id = auth.uid()
    )
);

-- Anyone can read post_teams
CREATE POLICY "Anyone can read post_teams"
ON public.post_teams
FOR SELECT
USING (true);

-- Policies for post_comments
CREATE POLICY "Anyone can read comments"
ON public.post_comments
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create comments"
ON public.post_comments
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own comments"
ON public.post_comments
FOR UPDATE
USING (author_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
ON public.post_comments
FOR DELETE
USING (author_id = auth.uid());

CREATE POLICY "Admins can manage all comments"
ON public.post_comments
USING (
    EXISTS (
        SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
    )
);

-- Policies for post_reactions
CREATE POLICY "Anyone can read reactions"
ON public.post_reactions
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create reactions"
ON public.post_reactions
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own reactions"
ON public.post_reactions
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions"
ON public.post_reactions
FOR DELETE
USING (user_id = auth.uid()); 