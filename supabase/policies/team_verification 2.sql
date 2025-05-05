-- Drop existing policy if it exists
drop policy if exists "Allow public team verification" on public.teams;

-- Create policy to allow anyone to verify team codes
create policy "Allow public team verification"
on public.teams
for select
using (true)
with check (false);

-- Note: This policy allows reading team data for verification purposes
-- The 'with check' clause ensures no one can modify the data through this policy 