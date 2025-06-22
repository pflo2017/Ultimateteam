require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Read environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// Use the provided service role key directly
const serviceRoleKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

if (!supabaseUrl) {
  console.error('Missing Supabase URL. Make sure EXPO_PUBLIC_SUPABASE_URL is set in .env file');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using service role key');

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);
const PLAYER_ID = '531d889b-974f-452a-88de-ea286935ed7c';

async function deletePlayerWithServiceKey() {
  try {
    console.log(`Starting deletion process for player ID: ${PLAYER_ID} using service role key`);
    
    // First, check if the player exists
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('parent_id, name')
      .eq('id', PLAYER_ID)
      .single();
    
    if (playerError) {
      console.error('Error finding player:', playerError);
      return;
    }
    
    if (!playerData) {
      console.log('Player not found');
      return;
    }
    
    console.log(`Found player: ${playerData.name}`);
    
    // Delete parent_children records if they exist
    if (playerData.parent_id) {
      console.log(`Deleting parent_children records for parent_id: ${playerData.parent_id}`);
      const { error: childDeleteError } = await supabase
        .from('parent_children')
        .delete()
        .eq('player_id', PLAYER_ID);
        
      if (childDeleteError) {
        console.error('Error deleting parent_children record:', childDeleteError);
      } else {
        console.log('Successfully deleted parent_children records');
      }
    }
    
    // Check for monthly_payments records and delete them
    const { data: paymentsData, error: paymentsCheckError } = await supabase
      .from('monthly_payments')
      .select('id')
      .eq('player_id', PLAYER_ID);
    
    if (paymentsCheckError) {
      console.error('Error checking payment records:', paymentsCheckError);
    } else if (paymentsData && paymentsData.length > 0) {
      console.log(`Found ${paymentsData.length} payment records to delete`);
      
      const { error: paymentsDeleteError } = await supabase
        .from('monthly_payments')
        .delete()
        .eq('player_id', PLAYER_ID);
      
      if (paymentsDeleteError) {
        console.error('Error deleting payment records:', paymentsDeleteError);
      } else {
        console.log('Successfully deleted payment records');
      }
    } else {
      console.log('No payment records found');
    }
    
    // Now delete the player record completely
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', PLAYER_ID);
      
    if (deleteError) {
      console.error('Error deleting player:', deleteError);
    } else {
      console.log('Successfully deleted player');
    }
    
    // Verify deletion
    const { data: verifyData, error: verifyError } = await supabase
      .from('players')
      .select('id, name')
      .eq('id', PLAYER_ID);
    
    if (verifyError) {
      console.error('Error verifying deletion:', verifyError);
    } else if (verifyData && verifyData.length > 0) {
      console.log('Warning: Player still exists after deletion attempt');
    } else {
      console.log('Verified: Player has been successfully deleted');
    }
    
    console.log('Player deletion process completed');
    
  } catch (error) {
    console.error('Error in delete process:', error);
  }
}

deletePlayerWithServiceKey(); 