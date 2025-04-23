-- Database structure backup
-- Generated on: 2024-04-23

-- Teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    access_code text not null unique,
    is_active boolean default true,
    admin_id uuid references auth.users(id) on delete cascade not null,
    coach_id uuid references public.coaches(id) on delete set null
);

-- Coaches table
CREATE TABLE IF NOT EXISTS public.coaches (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    phone_number text not null,
    access_code text not null unique,
    is_active boolean default true,
    admin_id uuid references auth.users(id) on delete cascade not null
);

-- Players table
CREATE TABLE IF NOT EXISTS public.players (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    team_id uuid references public.teams(id) on delete cascade,
    admin_id uuid references auth.users(id) on delete cascade not null,
    is_active boolean default true
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Teams are viewable by admin who created them"
    ON public.teams FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Teams are insertable by admin"
    ON public.teams FOR INSERT
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Teams are updatable by admin who created them"
    ON public.teams FOR UPDATE
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Teams are deletable by admin who created them"
    ON public.teams FOR DELETE
    USING (auth.uid() = admin_id);

-- Coaches policies
CREATE POLICY "Coaches are viewable by admin who created them"
    ON public.coaches FOR SELECT
    USING (auth.uid() = admin_id);

CREATE POLICY "Coaches are insertable by admin"
    ON public.coaches FOR INSERT
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Coaches are updatable by admin who created them"
    ON public.coaches FOR UPDATE
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Coaches are deletable by admin who created them"
    ON public.coaches FOR DELETE
    USING (auth.uid() = admin_id);

-- Players policies
CREATE POLICY "Enable read access for authenticated users"
    ON public.players FOR SELECT
    TO authenticated
    USING (auth.uid() = admin_id);

CREATE POLICY "Enable insert access for authenticated users"
    ON public.players FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Enable update access for authenticated users"
    ON public.players FOR UPDATE
    TO authenticated
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Enable delete access for authenticated users"
    ON public.players FOR DELETE
    TO authenticated
    USING (auth.uid() = admin_id);

-- Indexes
CREATE INDEX IF NOT EXISTS teams_admin_id_idx ON public.teams(admin_id);
CREATE INDEX IF NOT EXISTS teams_access_code_idx ON public.teams(access_code);
CREATE INDEX IF NOT EXISTS teams_coach_id_idx ON public.teams(coach_id);

CREATE INDEX IF NOT EXISTS coaches_admin_id_idx ON public.coaches(admin_id);
CREATE INDEX IF NOT EXISTS coaches_access_code_idx ON public.coaches(access_code);

CREATE INDEX IF NOT EXISTS players_admin_id_idx ON public.players(admin_id);
CREATE INDEX IF NOT EXISTS players_team_id_idx ON public.players(team_id); 