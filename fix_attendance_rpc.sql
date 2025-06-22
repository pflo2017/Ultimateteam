-- Create a function to fix the attendance_with_correct_dates view
CREATE OR REPLACE FUNCTION public.fix_attendance_view()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Drop the existing view and dependent objects
  DROP VIEW IF EXISTS public.attendance_with_correct_dates CASCADE;
  
  -- First create a helper function to extract the base UUID from activity_id
  CREATE OR REPLACE FUNCTION public.extract_base_activity_id(activity_id TEXT) 
  RETURNS TEXT AS $$
  BEGIN
    -- If the activity_id contains a dash (composite format like UUID-YYYYMMDD)
    IF (position('-' IN activity_id) > 0) AND (position('-202' IN activity_id) > 0) THEN
      -- Return just the UUID part before the date suffix
      RETURN substring(activity_id from 1 for position('-' IN activity_id)-1);
    ELSE
      -- Return the original ID if it's not composite
      RETURN activity_id;
    END IF;
  END;
  $$ LANGUAGE plpgsql;
  
  -- Create the new view with actual_activity_date column and joins
  CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
  SELECT 
    a.*,
    -- Join data from activities
    act.type AS activity_type,
    act.title AS activity_title,
    act.team_id,
    act.start_time AS actual_activity_date,
    -- Keep the original local_date column for backward compatibility
    date_trunc('day', a.created_at) AS local_date,
    -- Extract the clean base ID for easier debugging
    CASE
      WHEN position('-' IN a.activity_id) > 0 AND position('-202' IN a.activity_id) > 0
      THEN substring(a.activity_id from 1 for position('-' IN a.activity_id)-1)
      ELSE a.activity_id
    END AS base_activity_id
  FROM 
    public.activity_attendance a
  LEFT JOIN 
    public.activities act ON 
      CASE
        WHEN position('-' IN a.activity_id) > 0 AND position('-202' IN a.activity_id) > 0
        THEN substring(a.activity_id from 1 for position('-' IN a.activity_id)-1)
        ELSE a.activity_id
      END = act.id::text;
  
  -- Grant appropriate permissions
  GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;
  
  -- Recreate the dependent view user_attendance_reports
  CREATE OR REPLACE VIEW public.user_attendance_reports AS 
  SELECT * FROM public.attendance_with_correct_dates;
  
  -- Grant appropriate permissions to the dependent view
  GRANT SELECT ON public.user_attendance_reports TO authenticated;
  
  -- Return success result
  result := json_build_object(
    'success', true,
    'message', 'Successfully updated attendance_with_correct_dates view with optimized activity ID handling',
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.fix_attendance_view() TO authenticated;

-- Add comment explaining function purpose
COMMENT ON FUNCTION public.fix_attendance_view IS 'Fixes the attendance_with_correct_dates view by adding required columns and improving activity ID handling';

-- Call the function immediately to fix the view
SELECT fix_attendance_view(); 