-- Add coach_id column to teams table
alter table public.teams
add column coach_id uuid references public.coaches(id) on delete set null;

-- Create index for faster lookups
create index teams_coach_id_idx on public.teams(coach_id); 