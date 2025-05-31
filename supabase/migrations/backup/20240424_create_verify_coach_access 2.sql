-- Create a function to verify coach access codes
create or replace function public.verify_coach_access(p_access_code text)
returns json
language plpgsql
security definer -- This ensures the function runs with the privileges of the creator
as $$
declare
  v_coach_exists boolean;
  v_coach_data json;
  v_result json;
begin
  -- Get coach data if exists and is active
  select 
    case when c.id is not null then
      json_build_object(
        'id', c.id,
        'name', c.name,
        'club_id', c.club_id,
        'is_active', c.is_active,
        'access_code', c.access_code
      )
    else
      null
    end
  into v_coach_data
  from public.coaches c
  where c.access_code = p_access_code
    and c.is_active = true;

  -- Check if coach exists
  v_coach_exists := v_coach_data is not null;

  -- Construct the result
  v_result := json_build_object(
    'is_valid', v_coach_exists,
    'coach', v_coach_data
  );

  return v_result;
end;
$$;

-- Grant execute permission to the anon role
grant execute on function public.verify_coach_access(text) to anon; 