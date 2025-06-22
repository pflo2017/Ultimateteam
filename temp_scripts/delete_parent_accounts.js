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

async function deleteParentAccount(phoneNumber) {
  console.log(`\n=== Processing parent with phone: ${phoneNumber} ===`);
  
  try {
    // 1. Find the parent record
    const { data: parentData, error: parentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();
    
    if (parentError) {
      console.error(`Error finding parent with phone ${phoneNumber}:`, parentError);
      return;
    }
    
    if (!parentData) {
      console.log(`No parent found with phone number ${phoneNumber}`);
      return;
    }
    
    console.log(`Found parent: ${parentData.name} (ID: ${parentData.id})`);
    console.log(`Email: ${parentData.email}`);
    console.log(`User ID: ${parentData.user_id || 'Not set'}`);
    console.log(`Team ID: ${parentData.team_id || 'Not set'}`);
    
    // 2. Find any auth accounts associated with this parent
    const authIds = [];
    
    // Check by user_id if set
    if (parentData.user_id) {
      authIds.push(parentData.user_id);
      console.log(`Found auth account by user_id: ${parentData.user_id}`);
    }
    
    // Check for any auth accounts with matching email or phone
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing auth users:', listError);
    } else {
      const matchingUsers = users.filter(u => 
        (parentData.email && u.email === parentData.email) || 
        (u.phone && u.phone.includes(parentData.phone_number.replace('+', '')))
      );
      
      matchingUsers.forEach(user => {
        if (!authIds.includes(user.id)) {
          authIds.push(user.id);
          console.log(`Found auth account by ${user.email ? 'email' : 'phone'}: ${user.id}`);
        }
      });
    }
    
    // 3. Check for any children associated with this parent
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', parentData.id);
    
    if (childrenError) {
      console.error('Error checking for children:', childrenError);
    } else if (children && children.length > 0) {
      console.log(`Found ${children.length} children associated with this parent`);
      for (const child of children) {
        console.log(`- Child ID: ${child.id}, Name: ${child.full_name}`);
        
        // Delete child record
        const { error: deleteChildError } = await supabase
          .from('parent_children')
          .delete()
          .eq('id', child.id);
        
        if (deleteChildError) {
          console.error(`Error deleting child ${child.id}:`, deleteChildError);
        } else {
          console.log(`Deleted child: ${child.full_name}`);
        }
      }
    } else {
      console.log('No children found for this parent');
    }
    
    // 4. Delete the parent record
    const { error: deleteParentError } = await supabase
      .from('parents')
      .delete()
      .eq('id', parentData.id);
    
    if (deleteParentError) {
      console.error('Error deleting parent record:', deleteParentError);
    } else {
      console.log(`Deleted parent record: ${parentData.name}`);
    }
    
    // 5. Delete any associated auth accounts
    for (const authId of authIds) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authId);
      
      if (deleteAuthError) {
        console.error(`Error deleting auth account ${authId}:`, deleteAuthError);
      } else {
        console.log(`Deleted auth account: ${authId}`);
      }
    }
    
    console.log(`\n✅ Successfully processed parent with phone: ${phoneNumber}`);
    
  } catch (error) {
    console.error(`Error processing parent ${phoneNumber}:`, error);
  }
}

async function main() {
  try {
    // Delete the specified parent accounts
    await deleteParentAccount('+40760600600'); // Parent test
    await deleteParentAccount('+40750500500'); // Parent with team_id
    
    console.log('\n=== All parent accounts processed ===');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main(); 