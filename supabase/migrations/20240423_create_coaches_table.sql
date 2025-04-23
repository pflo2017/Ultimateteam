-- Create coaches table
create table if not exists public.coaches (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    phone_number text not null,
    access_code text not null unique,
    is_active boolean default true,
    admin_id uuid references auth.users(id) on delete cascade not null
);

-- Enable RLS
alter table public.coaches enable row level security;

-- Create policies
create policy "Coaches are viewable by admin who created them"
    on public.coaches for select
    using (auth.uid() = admin_id);

create policy "Coaches are insertable by admin"
    on public.coaches for insert
    with check (auth.uid() = admin_id);

create policy "Coaches are updatable by admin who created them"
    on public.coaches for update
    using (auth.uid() = admin_id)
    with check (auth.uid() = admin_id);

create policy "Coaches are deletable by admin who created them"
    on public.coaches for delete
    using (auth.uid() = admin_id);

-- Create index for faster lookups
create index coaches_admin_id_idx on public.coaches(admin_id);
create index coaches_access_code_idx on public.coaches(access_code); 