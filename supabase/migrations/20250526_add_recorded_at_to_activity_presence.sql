-- Add recorded_at column to activity_presence table
ALTER TABLE public.activity_presence
ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records to have recorded_at set to created_at if it exists
UPDATE public.activity_presence
SET recorded_at = created_at
WHERE recorded_at IS NULL AND created_at IS NOT NULL;

-- Make recorded_at NOT NULL after updating existing records
ALTER TABLE public.activity_presence
ALTER COLUMN recorded_at SET NOT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS activity_presence_recorded_at_idx 
ON public.activity_presence(recorded_at); 