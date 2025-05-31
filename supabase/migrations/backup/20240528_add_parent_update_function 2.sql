-- Create a stored procedure for updating parent profile data
-- This helps bypass any potential caching issues with the regular update API
create or replace function update_parent_profile(
  parent_id uuid,
  parent_name text,
  parent_email text
) returns void as $$
begin
  update parents
  set 
    name = parent_name,
    email = parent_email,
    updated_at = now()
  where id = parent_id;
end;
$$ language plpgsql; 