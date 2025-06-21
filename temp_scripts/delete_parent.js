const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Try to find the Supabase URL and service key
let supabaseUrl;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI';

try {
  // First try app.config.js
  const appConfigPath = path.join(__dirname, 'app.config.js');
  if (fs.existsSync(appConfigPath)) {
    const configContent = fs.readFileSync(appConfigPath, 'utf8');
    
    // Extract using regex
    const urlMatch = configContent.match(/supabaseUrl:\s*["']([^"']+)["']/);
    if (urlMatch) supabaseUrl = urlMatch[1];
  }
  
  // If still not found, try environment variables
  if (!supabaseUrl) supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  
} catch (error) {
  console.error('Error reading configuration:', error);
}

// Hardcoded values as last resort
if (!supabaseUrl) supabaseUrl = 'https://ulltpjezntzgiawchmaj.supabase.co';

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt user for confirmation
function askForConfirmation(message) {
  return new Promise((resolve) => {
    rl.question(`${message} (y/n): `, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function deleteParent(phoneNumber) {
  try {
    console.log(`Preparing to delete parent with phone number: ${phoneNumber}`);
    
    // 1. Get the parent record
    const { data: targetParent, error: targetParentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (targetParentError) {
      console.error('Error fetching target parent:', targetParentError);
      return;
    }
    
    if (!targetParent) {
      console.log('No parent found with phone number:', phoneNumber);
      return;
    }
    
    console.log('=== PARENT TO DELETE ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    console.log(`Email: ${targetParent.email}`);
    console.log(`Phone: ${targetParent.phone_number}`);
    console.log(`User ID: ${targetParent.user_id || 'Not set'}`);
    
    // 2. Check for related records
    // 2.1 Check for children records
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
      return;
    }
    
    console.log(`\nFound ${children?.length || 0} children records`);
    if (children && children.length > 0) {
      children.forEach((child, index) => {
        console.log(`- Child ${index + 1}: ${child.full_name || 'No name'} (ID: ${child.id})`);
      });
    }
    
    // 2.2 Check for player records
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
      return;
    }
    
    console.log(`\nFound ${players?.length || 0} player records`);
    if (players && players.length > 0) {
      players.forEach((player, index) => {
        console.log(`- Player ${index + 1}: ${player.name || 'No name'} (ID: ${player.id})`);
      });
    }
    
    // 3. Check for other potential related records
    // 3.1 Check for attendance records (if they exist)
    try {
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('player_id', players?.[0]?.id);
      
      if (!attendanceError && attendance && attendance.length > 0) {
        console.log(`\nFound ${attendance.length} attendance records for the first player`);
      }
    } catch (error) {
      // Table might not exist, ignore
    }
    
    // 4. Get confirmation from user
    const confirmDelete = await askForConfirmation('\nWARNING: This will delete the parent and all related records. Continue?');
    
    if (!confirmDelete) {
      console.log('Operation cancelled by user');
      rl.close();
      return;
    }
    
    console.log('\nStarting deletion process...');
    
    // 5. Delete in the correct order to respect foreign key constraints
    
    // 5.1. If there's an auth user and we have the parent's user_id, delete that too
    if (targetParent.user_id) {
      console.log(`Deleting auth user with ID: ${targetParent.user_id}`);
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        targetParent.user_id
      );
      
      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // Continue anyway, as we might still want to delete the parent
      } else {
        console.log('✅ Auth user deleted successfully');
      }
    }
    
    // 5.2. Delete attendance records if they exist
    if (players && players.length > 0) {
      for (const player of players) {
        try {
          console.log(`Checking for attendance records for player: ${player.id}`);
          const { data: attendance, error: attendanceError } = await supabase
            .from('attendance')
            .select('id')
            .eq('player_id', player.id);
          
          if (!attendanceError && attendance && attendance.length > 0) {
            console.log(`Deleting ${attendance.length} attendance records for player: ${player.id}`);
            const { error: deleteAttendanceError } = await supabase
              .from('attendance')
              .delete()
              .eq('player_id', player.id);
            
            if (deleteAttendanceError) {
              console.error(`Error deleting attendance for player ${player.id}:`, deleteAttendanceError);
            } else {
              console.log(`✅ Deleted attendance records for player: ${player.id}`);
            }
          }
        } catch (error) {
          // Table might not exist, ignore
        }
      }
    }
    
    // 5.3. Delete parent_children records
    if (children && children.length > 0) {
      console.log(`Deleting ${children.length} children records`);
      const { error: deleteChildrenError } = await supabase
        .from('parent_children')
        .delete()
        .eq('parent_id', targetParent.id);
      
      if (deleteChildrenError) {
        console.error('Error deleting children:', deleteChildrenError);
        console.log('Cannot proceed with parent deletion due to foreign key constraints');
        rl.close();
        return;
      } else {
        console.log('✅ Children records deleted successfully');
      }
    }
    
    // 5.4. Delete player records
    if (players && players.length > 0) {
      console.log(`Deleting ${players.length} player records`);
      const { error: deletePlayersError } = await supabase
        .from('players')
        .delete()
        .eq('parent_id', targetParent.id);
      
      if (deletePlayersError) {
        console.error('Error deleting players:', deletePlayersError);
        console.log('Cannot proceed with parent deletion due to foreign key constraints');
        rl.close();
        return;
      } else {
        console.log('✅ Player records deleted successfully');
      }
    }
    
    // 5.5. Finally delete the parent record
    console.log('Deleting parent record');
    const { error: deleteParentError } = await supabase
      .from('parents')
      .delete()
      .eq('id', targetParent.id);
    
    if (deleteParentError) {
      console.error('Error deleting parent:', deleteParentError);
      console.log('Parent deletion failed. There might be other foreign key constraints not handled');
    } else {
      console.log('✅ Parent record deleted successfully');
    }
    
    console.log('\n🎉 Deletion process completed');
    
  } catch (error) {
    console.error('Error during deletion process:', error);
  } finally {
    rl.close();
  }
}

// Get phone number from command line arguments or prompt user
async function main() {
  const phoneArg = process.argv[2];
  
  if (phoneArg) {
    await deleteParent(phoneArg);
  } else {
    rl.question('Enter the phone number of the parent to delete (e.g. +40760600600): ', async (phoneNumber) => {
      await deleteParent(phoneNumber);
    });
  }
}

main(); 