const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to find the Supabase URL and service key
let supabaseUrl;
const supabaseServiceKey = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

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

async function checkParentUserId() {
  try {
    // 1. Get the parent with phone +40760600600
    const { data: targetParent, error: targetParentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', '+40760600600')
      .maybeSingle();
    
    if (targetParentError) {
      console.error('Error fetching target parent:', targetParentError);
      return;
    }
    
    if (!targetParent) {
      console.log('No parent found with phone number +40760600600');
      return;
    }
    
    console.log('=== PARENT INFO ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    console.log(`Email: ${targetParent.email}`);
    console.log(`Phone: ${targetParent.phone_number}`);
    console.log(`User ID: ${targetParent.user_id || 'Not set'}`);
    console.log(`Team ID: ${targetParent.team_id || 'Not set'}`);
    console.log(`Created at: ${targetParent.created_at}`);
    console.log(`Updated at: ${targetParent.updated_at}`);
    
    // 2. Check if user_id is set
    if (!targetParent.user_id) {
      console.log('\n❌ This parent has no user_id set');
    } else {
      // 3. Check if the user_id exists in auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
        targetParent.user_id
      );
      
      if (authError) {
        console.error('Error fetching auth user:', authError);
      } else if (authUser && authUser.user) {
        console.log('\n✅ Found auth user account:');
        console.log(`ID: ${authUser.user.id}`);
        console.log(`Email: ${authUser.user.email}`);
        console.log(`Phone: ${authUser.user.phone}`);
        console.log(`Created at: ${authUser.user.created_at}`);
        console.log(`Last sign in: ${authUser.user.last_sign_in_at}`);
      } else {
        console.log('\n❌ No auth user found with ID:', targetParent.user_id);
      }
    }
    
    // 4. Check for auth users with this parent's email or phone
    if (targetParent.email) {
      const { data: emailUsers, error: emailError } = await supabase.auth.admin.listUsers();
      
      if (emailError) {
        console.error('Error listing users:', emailError);
      } else {
        const matchingEmailUsers = emailUsers.users.filter(user => 
          user.email === targetParent.email || 
          user.phone === targetParent.phone_number
        );
        
        if (matchingEmailUsers.length > 0) {
          console.log('\n=== MATCHING AUTH USERS ===');
          matchingEmailUsers.forEach(user => {
            console.log(`- ID: ${user.id}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Phone: ${user.phone}`);
            console.log(`  Created at: ${user.created_at}`);
            console.log(`  Last sign in: ${user.last_sign_in_at || 'Never'}`);
            console.log(`  Matches parent user_id: ${user.id === targetParent.user_id ? 'YES' : 'NO'}`);
          });
        } else {
          console.log('\nNo auth users found with matching email or phone');
        }
      }
    }
    
    // 5. Check for related records
    console.log('\n=== CHECKING RELATED RECORDS ===');
    
    // Check for children
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    } else {
      console.log(`Children records: ${children?.length || 0}`);
      if (children && children.length > 0) {
        children.forEach((child, index) => {
          console.log(`- Child ${index + 1}: ${child.full_name || 'No name'} (ID: ${child.id})`);
        });
      }
    }
    
    // Check for players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
    } else {
      console.log(`Player records: ${players?.length || 0}`);
      if (players && players.length > 0) {
        players.forEach((player, index) => {
          console.log(`- Player ${index + 1}: ${player.name || 'No name'} (ID: ${player.id})`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking parent user ID:', error);
  }
}

checkParentUserId()
  .then(() => console.log('\nCheck complete'))
  .catch(err => console.error('Error running check:', err)); 