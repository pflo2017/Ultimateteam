-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS public;

-- Create the teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    access_code text NOT NULL,
    admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    is_active boolean DEFAULT true
);

-- Verify the table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'teams'
); 