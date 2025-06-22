-- Remove team_id column from parents table
-- This column is no longer needed as parents are linked to teams through their children

-- First, check if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'parents'
    AND column_name = 'team_id'
  ) THEN
    -- Drop the column if it exists
    ALTER TABLE public.parents DROP COLUMN team_id;
    RAISE NOTICE 'Removed team_id column from parents table';
  ELSE
    RAISE NOTICE 'team_id column does not exist in parents table';
  END IF;
END $$; 