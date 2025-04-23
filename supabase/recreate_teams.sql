-- First, ensure we're in the right schema and clean up any existing objects
CREATE SCHEMA IF NOT EXISTS public;

-- Drop existing objects if they exist
DROP POLICY IF EXISTS "Teams are viewable by admin who created them" ON public.teams;
DROP POLICY IF EXISTS "Teams are insertable by authenticated admins" ON public.teams;
DROP POLICY IF EXISTS "Teams are updatable by admin who created them" ON public.teams;
DROP POLICY IF EXISTS "Teams are deletable by admin who created them" ON public.teams;
DROP INDEX IF EXISTS teams_admin_id_idx;
DROP INDEX IF EXISTS teams_access_code_idx;
DROP TABLE IF EXISTS public.teams;

-- Create the teams table
CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    access_code text NOT NULL,
    admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_active boolean DEFAULT true
);

-- Create indexes
CREATE UNIQUE INDEX teams_access_code_idx ON public.teams(access_code);
CREATE INDEX teams_admin_id_idx ON public.teams(admin_id);

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

-- Verify the table exists and show its structure
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'teams'
); 