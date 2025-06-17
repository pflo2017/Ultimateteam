-- Make player_id column nullable in parent_children table
ALTER TABLE public.parent_children
ALTER COLUMN player_id DROP NOT NULL; 