-- Add coach_id column to teams table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name = 'coach_id'
    ) THEN
        ALTER TABLE public.teams
        ADD COLUMN coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for faster lookups if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'teams' 
        AND indexname = 'teams_coach_id_idx'
    ) THEN
        CREATE INDEX teams_coach_id_idx ON public.teams(coach_id);
    END IF;
END $$; 