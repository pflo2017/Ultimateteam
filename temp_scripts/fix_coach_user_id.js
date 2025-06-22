// Script to fix coach user_id issues by linking coaches to their auth accounts
// This script will:
// 1. Find coaches with phone numbers but no user_id
// 2. Check if there are matching auth users with the same phone number
// 3. Update the coach records with the corresponding user_id

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCoachUserIds() {
  console.log('Starting coach user_id fix process...');
  
  // 1. Get all coaches with phone numbers but no user_id
  const { data: coaches, error: coachError } = await supabase
    .from('coaches')
    .select('id, name, phone_number, email')
    .is('user_id', null)
    .not('phone_number', 'is', null);
  
  if (coachError) {
    console.error('Error fetching coaches:', coachError);
    return;
  }
  
  console.log(`Found ${coaches.length} coaches with missing user_id`);
  
  // 2. Process each coach
  for (const coach of coaches) {
    console.log(`Processing coach: ${coach.name} (${coach.phone_number})`);
    
    // Normalize phone number format
    let phoneNumber = coach.phone_number.trim().replace(/\s/g, '');
    
    // 3. Look for matching auth user with this phone number
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, phone')
      .eq('phone', phoneNumber);
    
    if (authError) {
      console.error(`Error looking up auth user for ${coach.name}:`, authError);
      continue;
    }
    
    if (authUsers && authUsers.length > 0) {
      const authUser = authUsers[0];
      console.log(`Found matching auth user ${authUser.id} for coach ${coach.name}`);
      
      // 4. Update the coach record with the user_id
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ user_id: authUser.id })
        .eq('id', coach.id);
      
      if (updateError) {
        console.error(`Error updating coach ${coach.name}:`, updateError);
      } else {
        console.log(`✅ Successfully updated coach ${coach.name} with user_id ${authUser.id}`);
      }
    } else {
      console.log(`⚠️ No matching auth user found for coach ${coach.name} with phone ${phoneNumber}`);
    }
  }
  
  console.log('Coach user_id fix process completed');
}

// Execute the function
fixCoachUserIds().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 