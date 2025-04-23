-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS teams_access_code_idx ON public.teams(access_code);
CREATE INDEX IF NOT EXISTS teams_admin_id_idx ON public.teams(admin_id);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Teams are viewable by admin who created them" 
ON public.teams FOR SELECT 
USING (auth.uid() = admin_id);

CREATE POLICY "Teams are insertable by authenticated admins" 
ON public.teams FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Teams are updatable by admin who created them" 
ON public.teams FOR UPDATE 
USING (auth.uid() = admin_id);

CREATE POLICY "Teams are deletable by admin who created them" 
ON public.teams FOR DELETE 
USING (auth.uid() = admin_id);

-- Grant necessary privileges
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role; 