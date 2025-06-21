require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Read environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Use the provided service role key for verification
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI';

if (!supabaseUrl) {
  console.error('Missing Supabase URL. Make sure EXPO_PUBLIC_SUPABASE_URL is set in .env file');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);
const PLAYER_ID = '531d889b-974f-452a-88de-ea286935ed7c';

async function verifyDeletion() {
  try {
    console.log(`Verifying deletion of player ID: ${PLAYER_ID}`);
    
    // Check if player exists
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', PLAYER_ID);
    
    if (playerError) {
      console.error('Error checking player:', playerError);
      return;
    }
    
    if (playerData && playerData.length > 0) {
      console.log('Player still exists in the database:', playerData);
    } else {
      console.log('Player has been successfully deleted from the database.');
    }
    
    // Check if parent_children records exist
    const { data: childrenData, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('player_id', PLAYER_ID);
    
    if (childrenError) {
      console.error('Error checking parent_children records:', childrenError);
    } else if (childrenData && childrenData.length > 0) {
      console.log('Warning: parent_children records still exist:', childrenData);
    } else {
      console.log('No parent_children records found for this player.');
    }
    
    // Check for any other related records (like monthly_payments)
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('monthly_payments')
      .select('*')
      .eq('player_id', PLAYER_ID);
    
    if (paymentsError) {
      console.error('Error checking payment records:', paymentsError);
    } else if (paymentsData && paymentsData.length > 0) {
      console.log('Warning: monthly_payments records still exist:', paymentsData);
    } else {
      console.log('No monthly_payments records found for this player.');
    }
    
  } catch (error) {
    console.error('Error in verification process:', error);
  }
}

verifyDeletion(); 