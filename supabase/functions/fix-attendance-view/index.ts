// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.32.0'

console.log("Hello from Functions!")

serve(async (req) => {
  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      // Supabase API URL - env var exported by default
      Deno.env.get('SUPABASE_URL') ?? '',
      // Supabase API SERVICE ROLE KEY - env var exported by default
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // First, let's drop the existing view if it exists
    const { error: dropError } = await supabaseClient.rpc('drop_view', {
      view_name: 'attendance_with_correct_dates'
    })

    if (dropError) {
      console.error('Error dropping view:', dropError)
      return new Response(JSON.stringify({
        error: 'Failed to drop view',
        details: dropError
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Now create the new view with the actual_activity_date column
    const createViewSQL = `
      CREATE OR REPLACE VIEW public.attendance_with_correct_dates AS 
      SELECT 
          a.*,
          -- Extract the actual date from composite activity IDs or use the activity start time
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
    `

    // Execute the SQL to create the view
    const { error: createError } = await supabaseClient.rpc('exec_sql', {
      sql: createViewSQL
    })

    if (createError) {
      console.error('Error creating view:', createError)
      
      // Try an alternative method with plain SQL query
      const { error: altCreateError } = await supabaseClient
        .from('_exec_sql')
        .insert({ sql: createViewSQL })

      if (altCreateError) {
        return new Response(JSON.stringify({
          error: 'Failed to create view using both methods',
          rpcError: createError,
          sqlError: altCreateError
        }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500,
        })
      }
    }

    // Grant appropriate permissions
    const { error: grantError } = await supabaseClient.rpc('exec_sql', {
      sql: 'GRANT SELECT ON public.attendance_with_correct_dates TO authenticated;'
    })

    if (grantError) {
      // Non-critical error, just log it
      console.warn('Error granting permissions (non-critical):', grantError)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully updated attendance_with_correct_dates view with actual_activity_date column'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/fix-attendance-view' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
