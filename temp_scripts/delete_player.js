require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const PLAYER_ID = '531d889b-974f-452a-88de-ea286935ed7c';

async function deletePlayer() {
  try {
    console.log(`Starting deletion process for player ID: ${PLAYER_ID}`);
    
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
        // Continue even if this fails
      } else {
        console.log('Successfully deleted parent_children records');
      }
    }
    
    // Check for attendance records and delete them
    const { data: attendanceData, error: attendanceCheckError } = await supabase
      .from('attendance')
      .select('id')
      .eq('player_id', PLAYER_ID);
    
    if (attendanceCheckError) {
      console.error('Error checking attendance records:', attendanceCheckError);
    } else if (attendanceData && attendanceData.length > 0) {
      console.log(`Found ${attendanceData.length} attendance records to delete`);
      
      const { error: attendanceDeleteError } = await supabase
        .from('attendance')
        .delete()
        .eq('player_id', PLAYER_ID);
      
      if (attendanceDeleteError) {
        console.error('Error deleting attendance records:', attendanceDeleteError);
      } else {
        console.log('Successfully deleted attendance records');
      }
    } else {
      console.log('No attendance records found');
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
    
    console.log('Player deletion process completed');
    
  } catch (error) {
    console.error('Error in delete process:', error);
  }
}

deletePlayer(); 