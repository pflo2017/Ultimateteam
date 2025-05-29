/**
 * This script fixes the coach-auth linking issue by:
 * 1. Finding all coaches with null user_id
 * 2. Looking up auth users with matching phone numbers
 * 3. Updating the coaches table to link them
 * 
 * Run with: node scripts/fix-coach-auth.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key (needed for auth.users access)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must use service role key to access auth.users

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCoachUserIds() {
  console.log('Starting coach-auth linking process...');
  
  try {
    // 1. Get all coaches with null user_id
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, phone_number')
      .is('user_id', null);
    
    if (coachError) {
      throw coachError;
    }
    
    console.log(`Found ${coaches.length} coaches with null user_id`);
    
    // Process each coach
    for (const coach of coaches) {
      console.log(`Processing coach: ${coach.name} (${coach.phone_number})`);
      
      // Format phone for comparison with auth users
      let phoneForSearch = coach.phone_number;
      if (phoneForSearch.startsWith('+')) {
        phoneForSearch = phoneForSearch.substring(1); // Remove + for comparison
      }
      
      // 2. Look for auth users with matching phone number
      const { data: users, error: userError } = await supabase
        .from('auth.users')
        .select('id, phone')
        .eq('phone', phoneForSearch);
        
      if (userError) {
        console.error(`Error looking up auth user for ${coach.name}:`, userError);
        continue;
      }
      
      if (!users || users.length === 0) {
        console.log(`No auth user found for coach: ${coach.name} (${coach.phone_number})`);
        continue;
      }
      
      if (users.length > 1) {
        console.warn(`Multiple auth users found for coach: ${coach.name} (${coach.phone_number}). Using the first one.`);
      }
      
      const userId = users[0].id;
      console.log(`Found matching auth user: ${userId}`);
      
      // 3. Update the coach's user_id
      const { error: updateError } = await supabase
        .from('coaches')
        .update({ user_id: userId })
        .eq('id', coach.id);
        
      if (updateError) {
        console.error(`Error updating coach ${coach.name}:`, updateError);
      } else {
        console.log(`✓ Successfully linked coach ${coach.name} to auth user ${userId}`);
      }
    }
    
    console.log('Coach-auth linking process completed.');
  } catch (error) {
    console.error('Error in fixCoachUserIds:', error);
  }
}

// Run the function
fixCoachUserIds(); 