-- Create clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    logo_url text,
    admin_id uuid references auth.users(id) on delete cascade not null,
    is_active boolean default true,
    phone_number text,
    email text,
    address text,
    city text,
    country text,
    website text,
    description text
);

-- Enable RLS for clubs
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Create policies for clubs
CREATE POLICY "Clubs are viewable by their admin"
    ON public.clubs FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Clubs are insertable by admin"
    ON public.clubs FOR INSERT
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Clubs are updatable by their admin"
    ON public.clubs FOR UPDATE
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Clubs are deletable by their admin"
    ON public.clubs FOR DELETE
    USING (auth.uid() = admin_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS clubs_admin_id_idx ON public.clubs(admin_id);

-- Add club_id to teams table
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS club_id uuid references public.clubs(id) on delete cascade;

-- Update existing teams to link to their admin's club
UPDATE public.teams t
SET club_id = (
    SELECT c.id 
    FROM public.clubs c 
    WHERE c.admin_id = t.admin_id
    LIMIT 1
);

-- Make club_id required for teams
ALTER TABLE public.teams
ALTER COLUMN club_id SET NOT NULL;

-- Add club_id to coaches table
ALTER TABLE public.coaches
ADD COLUMN IF NOT EXISTS club_id uuid references public.clubs(id) on delete cascade;

-- Update existing coaches to link to their admin's club
UPDATE public.coaches c
SET club_id = (
    SELECT cl.id 
    FROM public.clubs cl 
    WHERE cl.admin_id = c.admin_id
    LIMIT 1
);

-- Make club_id required for coaches
ALTER TABLE public.coaches
ALTER COLUMN club_id SET NOT NULL;

-- Add club_id to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS club_id uuid references public.clubs(id) on delete cascade;

-- Update existing players to link to their admin's club
UPDATE public.players p
SET club_id = (
    SELECT cl.id 
    FROM public.clubs cl 
    WHERE cl.admin_id = p.admin_id
    LIMIT 1
);

-- Make club_id required for players
ALTER TABLE public.players
ALTER COLUMN club_id SET NOT NULL;

-- Create indexes for club_id
CREATE INDEX IF NOT EXISTS teams_club_id_idx ON public.teams(club_id);
CREATE INDEX IF NOT EXISTS coaches_club_id_idx ON public.coaches(club_id);
CREATE INDEX IF NOT EXISTS players_club_id_idx ON public.players(club_id);

-- Update RLS policies to include club-level checks
DROP POLICY IF EXISTS "Teams are viewable by admin who created them" ON public.teams;
CREATE POLICY "Teams are viewable by club admin"
    ON public.teams FOR SELECT
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teams are insertable by admin" ON public.teams;
CREATE POLICY "Teams are insertable by club admin"
    ON public.teams FOR INSERT
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teams are updatable by admin who created them" ON public.teams;
CREATE POLICY "Teams are updatable by club admin"
    ON public.teams FOR UPDATE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Teams are deletable by admin who created them" ON public.teams;
CREATE POLICY "Teams are deletable by club admin"
    ON public.teams FOR DELETE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

-- Similar updates for coaches policies
DROP POLICY IF EXISTS "Coaches are viewable by admin who created them" ON public.coaches;
CREATE POLICY "Coaches are viewable by club admin"
    ON public.coaches FOR SELECT
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Coaches are insertable by admin" ON public.coaches;
CREATE POLICY "Coaches are insertable by club admin"
    ON public.coaches FOR INSERT
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Coaches are updatable by admin who created them" ON public.coaches;
CREATE POLICY "Coaches are updatable by club admin"
    ON public.coaches FOR UPDATE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Coaches are deletable by admin who created them" ON public.coaches;
CREATE POLICY "Coaches are deletable by club admin"
    ON public.coaches FOR DELETE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

-- Similar updates for players policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.players;
CREATE POLICY "Players are viewable by club admin"
    ON public.players FOR SELECT
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.players;
CREATE POLICY "Players are insertable by club admin"
    ON public.players FOR INSERT
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.players;
CREATE POLICY "Players are updatable by club admin"
    ON public.players FOR UPDATE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.players;
CREATE POLICY "Players are deletable by club admin"
    ON public.players FOR DELETE
    USING (
        auth.uid() = admin_id 
        AND club_id IN (
            SELECT id FROM public.clubs 
            WHERE admin_id = auth.uid()
        )
    ); 