-- Add birth_date column if it doesn't exist
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS birth_date TIMESTAMP WITH TIME ZONE;

-- Copy birthdates from parent_children to players
UPDATE public.players p
SET birth_date = pc.birth_date
FROM public.parent_children pc
WHERE p.parent_id = pc.parent_id
AND LOWER(p.name) = LOWER(pc.full_name)
AND pc.is_active = true
AND p.birth_date IS NULL;

-- Add index for birth_date
CREATE INDEX IF NOT EXISTS players_birth_date_idx ON public.players(birth_date); 