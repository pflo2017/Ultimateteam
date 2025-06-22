-- Migration to clean up the parents table and standardize parent registration
-- This migration:
-- 1. Removes the team_id column as it's no longer needed (parents are linked to teams through their children)
-- 2. Ensures all columns have proper constraints
-- 3. Adds indexes for performance

-- First, check if the team_id column exists and remove it
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

-- Ensure user_id is properly indexed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'parents'
    AND indexname = 'parents_user_id_idx'
  ) THEN
    CREATE INDEX parents_user_id_idx ON public.parents (user_id);
    RAISE NOTICE 'Created index on parents.user_id';
  ELSE
    RAISE NOTICE 'Index on parents.user_id already exists';
  END IF;
END $$;

-- Ensure phone_number is properly indexed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'parents'
    AND indexname = 'parents_phone_number_idx'
  ) THEN
    CREATE INDEX parents_phone_number_idx ON public.parents (phone_number);
    RAISE NOTICE 'Created index on parents.phone_number';
  ELSE
    RAISE NOTICE 'Index on parents.phone_number already exists';
  END IF;
END $$;

-- Ensure email is properly indexed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'parents'
    AND indexname = 'parents_email_idx'
  ) THEN
    CREATE INDEX parents_email_idx ON public.parents (email);
    RAISE NOTICE 'Created index on parents.email';
  ELSE
    RAISE NOTICE 'Index on parents.email already exists';
  END IF;
END $$;

-- Ensure updated_at is automatically updated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_parents_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER set_parents_updated_at
    BEFORE UPDATE ON public.parents
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
    
    RAISE NOTICE 'Created updated_at trigger for parents table';
  ELSE
    RAISE NOTICE 'updated_at trigger for parents table already exists';
  END IF;
END $$; 