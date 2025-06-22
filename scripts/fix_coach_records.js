#!/usr/bin/env node

/**
 * Script to fix coach records by linking them to auth users
 * This script finds coaches with null user_id and tries to link them to auth users with matching phone numbers
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Check for required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCoachRecords() {
  console.log('Starting coach record fix process...');
  
  try {
    // 1. Call the database function to fix all coach user_ids
    console.log('Calling fix_coach_user_ids function...');
    const { data, error } = await supabase.rpc('fix_coach_user_ids');
    
    if (error) {
      console.error('Error calling fix_coach_user_ids:', error);
      
      // Fallback to manual process if the function fails
      console.log('Falling back to manual process...');
      await manualFixCoachRecords();
      return;
    }
    
    console.log('Results from fix_coach_user_ids:');
    if (data && data.length > 0) {
      data.forEach(result => {
        if (result.success) {
          console.log(`✅ Successfully linked coach ${result.coach_name} (${result.phone_number}) to auth user ${result.auth_user_id}`);
        } else {
          console.log(`⚠️ Could not find auth user for coach ${result.coach_name} (${result.phone_number})`);
        }
      });
    } else {
      console.log('No coaches needed fixing or no results returned');
    }
    
    // 2. Verify the results
    await verifyCoachRecords();
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

async function manualFixCoachRecords() {
  console.log('Starting manual coach fix process...');
  
  try {
    // 1. Get all coaches with null user_id
    const { data: coaches, error: coachError } = await supabase
      .from('coaches')
      .select('id, name, phone_number')
      .is('user_id', null);
    
    if (coachError) {
      console.error('Error fetching coaches:', coachError);
      return;
    }
    
    console.log(`Found ${coaches.length} coaches with null user_id`);
    
    // 2. Get all auth users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error listing auth users:', authError);
      return;
    }
    
    // 3. Process each coach
    for (const coach of coaches) {
      console.log(`Processing coach: ${coach.name} (${coach.phone_number})`);
      
      // Normalize phone number for comparison
      const normalizedCoachPhone = normalizePhoneNumber(coach.phone_number);
      
      // Find matching auth user
      const matchingUser = authData.users.find(user => {
        if (!user.phone) return false;
        return normalizePhoneNumber(user.phone) === normalizedCoachPhone;
      });
      
      if (matchingUser) {
        console.log(`Found matching auth user: ${matchingUser.id}`);
        
        // Update coach record
        const { error: updateError } = await supabase
          .from('coaches')
          .update({ user_id: matchingUser.id })
          .eq('id', coach.id);
        
        if (updateError) {
          console.error(`Error updating coach ${coach.name}:`, updateError);
        } else {
          console.log(`✅ Successfully linked coach ${coach.name} to auth user ${matchingUser.id}`);
        }
      } else {
        console.log(`⚠️ No matching auth user found for coach ${coach.name}`);
      }
    }
  } catch (err) {
    console.error('Error in manual fix process:', err);
  }
}

async function verifyCoachRecords() {
  console.log('\nVerifying coach records...');
  
  try {
    // Count coaches with null user_id
    const { count, error } = await supabase
      .from('coaches')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);
    
    if (error) {
      console.error('Error verifying coach records:', error);
      return;
    }
    
    if (count === 0) {
      console.log('✅ All coaches have user_id set!');
    } else {
      console.log(`⚠️ There are still ${count} coaches with null user_id.`);
      console.log('You may need to create auth accounts for these coaches manually.');
    }
  } catch (err) {
    console.error('Error verifying coach records:', err);
  }
}

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove spaces and other non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Replace +0 with +4 for Romanian numbers
  if (normalized.startsWith('+0')) {
    normalized = '+4' + normalized.substring(2);
  }
  
  return normalized;
}

// Run the script
fixCoachRecords().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
}); 