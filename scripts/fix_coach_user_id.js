// Script to fix coach user_id issues
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

async function fixCoachUserIds() {
  console.log('Starting coach user_id fix...');
  
  try {
    // 1. Get all coaches with null user_id
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('*')
      .is('user_id', null);
    
    if (coachError) {
      console.error('Error fetching coaches:', coachError);
      return;
    }
    
    console.log(`Found ${coaches.length} coaches with null user_id`);
    
    // 2. For each coach, try to find matching auth user by phone
    for (const coach of coaches) {
      console.log(`Processing coach: ${coach.name} (${coach.phone_number})`);
      
      try {
        // Try to get auth users with matching phone
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        
        if (authError) {
          console.error('Error listing auth users:', authError);
          continue;
        }
        
        // Find users with matching phone
        const matchingUsers = authData.users.filter(user => {
          // Format phone numbers for comparison (remove +, spaces, leading zeros)
          const formattedAuthPhone = (user.phone || '').replace(/\+|\s/g, '').replace(/^0/, '');
          const formattedCoachPhone = coach.phone_number.replace(/\+|\s/g, '').replace(/^0/, '');
          return formattedAuthPhone === formattedCoachPhone;
        });
        
        if (matchingUsers.length > 0) {
          const authUser = matchingUsers[0];
          console.log(`Found matching auth user: ${authUser.id} for coach ${coach.name}`);
          
          // Update the coach record
          const { error: updateError } = await supabase
            .from('coaches')
            .update({ user_id: authUser.id })
            .eq('id', coach.id);
            
          if (updateError) {
            console.error(`Error updating coach ${coach.name}:`, updateError);
          } else {
            console.log(`Successfully updated coach ${coach.name} with user_id ${authUser.id}`);
          }
        } else {
          console.log(`No matching auth user found for coach ${coach.name} (${coach.phone_number})`);
        }
      } catch (err) {
        console.error(`Error processing coach ${coach.name}:`, err);
      }
    }
    
    console.log('Coach user_id fix completed');
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

fixCoachUserIds().catch(console.error); 