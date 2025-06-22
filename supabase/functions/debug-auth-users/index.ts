import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Check if the user is a master admin
    const { data: masterAdmin, error: masterAdminError } = await supabaseClient
      .from('master_admins')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (masterAdminError || !masterAdmin) {
      throw new Error('Not authorized - only master admins can access this function')
    }

    // Get data from auth_user_details view
    const { data: authUserDetails, error: authUserDetailsError } = await supabaseClient
      .from('auth_user_details')
      .select('*')
      .limit(10)

    // Get data from auth_sessions view
    const { data: authSessions, error: authSessionsError } = await supabaseClient
      .from('auth_sessions')
      .select('*')
      .limit(10)

    // Get data from master_admins table
    const { data: masterAdmins, error: masterAdminsError } = await supabaseClient
      .from('master_admins')
      .select('*')

    // Get data from admin_profiles table
    const { data: adminProfiles, error: adminProfilesError } = await supabaseClient
      .from('admin_profiles')
      .select('*')
      .limit(10)

    // Get data from coaches table
    const { data: coaches, error: coachesError } = await supabaseClient
      .from('coaches')
      .select('*')
      .limit(10)

    // Get data from parents table
    const { data: parents, error: parentsError } = await supabaseClient
      .from('parents')
      .select('*')
      .limit(10)

    // Return the data
    return new Response(
      JSON.stringify({
        success: true,
        authUserDetails: {
          data: authUserDetails,
          error: authUserDetailsError,
          count: authUserDetails?.length || 0
        },
        authSessions: {
          data: authSessions,
          error: authSessionsError,
          count: authSessions?.length || 0
        },
        masterAdmins: {
          data: masterAdmins,
          error: masterAdminsError,
          count: masterAdmins?.length || 0
        },
        adminProfiles: {
          data: adminProfiles,
          error: adminProfilesError,
          count: adminProfiles?.length || 0
        },
        coaches: {
          data: coaches,
          error: coachesError,
          count: coaches?.length || 0
        },
        parents: {
          data: parents,
          error: parentsError,
          count: parents?.length || 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
}) 