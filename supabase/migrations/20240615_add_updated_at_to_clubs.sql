-- Add updated_at column to clubs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'clubs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE clubs ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
  END IF;
END
$$;

-- Update all existing rows to have updated_at = created_at if it's null
UPDATE clubs
SET updated_at = created_at
WHERE updated_at IS NULL; 