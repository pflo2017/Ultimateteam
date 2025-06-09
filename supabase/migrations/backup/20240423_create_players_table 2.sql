-- Create players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    name TEXT NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON public.players
    FOR SELECT
    TO authenticated
    USING (auth.uid() = admin_id);

CREATE POLICY "Enable insert access for authenticated users" ON public.players
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Enable update access for authenticated users" ON public.players
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = admin_id)
    WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Enable delete access for authenticated users" ON public.players
    FOR DELETE
    TO authenticated
    USING (auth.uid() = admin_id);

-- Create indexes
CREATE INDEX players_admin_id_idx ON public.players(admin_id);
CREATE INDEX players_team_id_idx ON public.players(team_id); 