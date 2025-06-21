import { createClient } from '@supabase/supabase-js';
require('dotenv').config();

// Use environment variables or fallback to placeholders
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ulltpjezntzgiawchmaj.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "REMOVED_FOR_SECURITY";

// Initialize the Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Function to fix the attendance_with_correct_dates view
async function fixAttendanceView() {
  console.log('Starting to fix attendance_with_correct_dates view...');
  
  try {
    // Drop the existing view
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql_statement: 'DROP VIEW IF EXISTS public.attendance_with_correct_dates;'
    });
    
    if (dropError) {
      console.error('Error dropping view:', dropError);
      return;
    }
    
    console.log('Successfully dropped the existing view');
    
    // Create the new view with actual_activity_date column
    const createViewSQL = `
      CREATE VIEW public.attendance_with_correct_dates AS 
      SELECT 
          a.*,
          -- Extract the actual date from composite activity IDs or use the activity start date
          CASE
              -- When activity_id contains a date component (format UUID-YYYYMMDD)
              WHEN position('-202' IN a.activity_id) > 0 THEN 
                  -- Extract date from the activity_id suffix
                  to_date(substring(a.activity_id from position('-' IN a.activity_id) + 1), 'YYYYMMDD')::timestamp with time zone
              ELSE
                  -- For regular activities, join with activities table to get the start_time
                  (SELECT start_time FROM activities WHERE id::text = a.activity_id)
          END AS actual_activity_date,
          -- Keep the original local_date column for backward compatibility
          date_trunc('day', a.created_at) AS local_date
      FROM 
          public.activity_attendance a;
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql_statement: createViewSQL
    });
    
    if (createError) {
      console.error('Error creating view:', createError);
      return;
    }
    
    console.log('Successfully created the new view with actual_activity_date column');
    
    // Create an index for performance (this may fail for views but we'll try anyway)
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql_statement: 'CREATE INDEX IF NOT EXISTS attendance_actual_date_idx ON attendance_with_correct_dates(actual_activity_date);'
    });
    
    if (indexError) {
      console.error('Error creating index (expected for views):', indexError);
      // Continue as this is expected to fail for views
    } else {
      console.log('Successfully created index (if needed)');
    }
    
    // Grant permissions
    const { error: grantError } = await supabase.rpc('exec_sql', {
      sql_statement: 'GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;'
    });
    
    if (grantError) {
      console.error('Error granting permissions:', grantError);
      // Continue as this is not critical
    } else {
      console.log('Successfully granted permissions');
    }
    
    console.log('View fix completed successfully!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Execute the function
fixAttendanceView()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 