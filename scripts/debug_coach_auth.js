// Debug script for coach authentication issues
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create a client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Phone number to check (can be passed as argument)
const phoneToCheck = process.argv[2] || '+40700009009';

async function debugCoachAuth() {
  console.log(`Debugging coach authentication for phone: ${phoneToCheck}`);
  
  try {
    // 1. Check if coach exists
    console.log('\n--- Checking for coach in coaches table ---');
    const { data: coachData, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .eq('phone_number', phoneToCheck);
      
    if (coachError) {
      console.error('Error querying coaches:', coachError);
    } else if (!coachData || coachData.length === 0) {
      console.log('No coach found with this phone number');
    } else {
      console.log('Coach found:', {
        id: coachData[0].id,
        name: coachData[0].name,
        phone_number: coachData[0].phone_number,
        user_id: coachData[0].user_id,
        registration_completed: coachData[0].user_id !== null
      });
    }
    
    // 2. Check if auth user exists
    console.log('\n--- Checking for user in auth.users ---');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      filters: {
        phone: phoneToCheck
      }
    });
    
    if (authError) {
      console.error('Error querying auth users:', authError);
    } else if (!authData || !authData.users || authData.users.length === 0) {
      console.log('No auth user found with this phone number');
    } else {
      console.log('Auth user found:', {
        id: authData.users[0].id,
        phone: authData.users[0].phone,
        created_at: authData.users[0].created_at,
        email: authData.users[0].email,
        user_metadata: authData.users[0].user_metadata
      });
    }
    
    // 3. Check if the check_phone_exists function works
    console.log('\n--- Testing check_phone_exists function ---');
    const { data: funcData, error: funcError } = await supabase
      .rpc('check_phone_exists', { phone_param: phoneToCheck });
      
    if (funcError) {
      console.error('Error calling check_phone_exists:', funcError);
    } else {
      console.log('check_phone_exists result:', funcData);
    }
    
    // 4. Try direct sign-in to see if auth recognizes the phone
    console.log('\n--- Testing direct sign-in ---');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      phone: phoneToCheck,
      password: 'dummy_password_for_check_only'
    });
    
    if (signInError) {
      if (signInError.message && signInError.message.includes('Invalid login credentials')) {
        console.log('Phone exists in auth (got Invalid login credentials error)');
      } else {
        console.error('Error during sign-in test:', signInError);
      }
    } else {
      console.log('Unexpected success with dummy password');
    }
    
    // 5. Check registration status based on user_id
    console.log('\n--- Checking coach registration status ---');
    if (coachData && coachData.length > 0) {
      const coach = coachData[0];
      if (coach.user_id) {
        console.log('Registration status: COMPLETED (user_id is set)');
      } else {
        console.log('Registration status: PENDING (user_id is null)');
      }
    }
    
    // 6. Provide recommendations
    console.log('\n--- Recommendations ---');
    if (coachData && coachData.length > 0 && authData && authData.users && authData.users.length > 0) {
      const coach = coachData[0];
      const authUser = authData.users[0];
      
      if (!coach.user_id) {
        console.log('ISSUE: Coach exists but has no user_id. Need to link coach to auth user.');
        console.log('SOLUTION: Run this SQL:');
        console.log(`UPDATE coaches SET user_id = '${authUser.id}' WHERE id = '${coach.id}';`);
      } else if (coach.user_id !== authUser.id) {
        console.log('ISSUE: Coach has wrong user_id. Need to update with correct auth user ID.');
        console.log('SOLUTION: Run this SQL:');
        console.log(`UPDATE coaches SET user_id = '${authUser.id}' WHERE id = '${coach.id}';`);
      } else {
        console.log('Coach and auth user are properly linked.');
      }
      
      if (!funcData || !funcData.exists) {
        console.log('ISSUE: check_phone_exists function is not detecting the auth user.');
        console.log('SOLUTION: Check the function implementation and permissions.');
      }
    } else if (coachData && coachData.length > 0) {
      console.log('ISSUE: Coach exists but no auth user found.');
      console.log('SOLUTION: Coach needs to register through the app.');
    } else if (authData && authData.users && authData.users.length > 0) {
      console.log('ISSUE: Auth user exists but no coach record found.');
      console.log('SOLUTION: Create a coach record and link it to the auth user.');
    } else {
      console.log('No coach or auth user found for this phone number.');
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

debugCoachAuth().catch(console.error); 