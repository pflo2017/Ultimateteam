const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Load Supabase URL from app.config.js
const configPath = path.join(__dirname, 'app.config.js');
const configContent = fs.readFileSync(configPath, 'utf-8');

// Extract Supabase URL using regex
const supabaseUrlMatch = configContent.match(/supabaseUrl:.*?["'](https:\/\/[^"']+)["']/);
if (!supabaseUrlMatch) {
  console.error('Could not find supabaseUrl in app.config.js');
  process.exit(1);
}
const SUPABASE_URL = supabaseUrlMatch[1];

// Use the provided service role key
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsbHRwamV6bnR6Z2lhd2NobWFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTMzNzM0MiwiZXhwIjoyMDYwOTEzMzQyfQ.5MPohDgqv5b4U77jLnEZ-zeYVlazThOjNNKVzrcrfoI';

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function fixParentsWithChildren() {
  try {
    console.log('Fetching parent records with children but without user_id...');
    
    // Get all parents
    const { data: allParents, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .is('user_id', null);
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      rl.close();
      return;
    }
    
    // Get all parent-children relationships
    const { data: allParentChildren, error: pcError } = await supabase
      .from('parent_children')
      .select('parent_id, full_name');
      
    if (pcError) {
      console.error('Error fetching parent-children relationships:', pcError);
      rl.close();
      return;
    }
    
    // Create a map of parent IDs to their children
    const parentChildrenMap = {};
    for (const pc of allParentChildren) {
      if (!parentChildrenMap[pc.parent_id]) {
        parentChildrenMap[pc.parent_id] = [];
      }
      parentChildrenMap[pc.parent_id].push(pc.full_name);
    }
    
    // Filter parents with children
    const parentsWithChildren = allParents.filter(parent => 
      parentChildrenMap[parent.id] && parentChildrenMap[parent.id].length > 0
    );
    
    console.log(`\nFound ${parentsWithChildren.length} parents with children that don't have user_id`);
    
    if (parentsWithChildren.length === 0) {
      console.log('No parents to fix.');
      rl.close();
      return;
    }
    
    // Display parents to fix
    console.log('\n=== PARENTS TO FIX ===');
    parentsWithChildren.forEach((parent, index) => {
      console.log(`\n${index + 1}. ${parent.name}`);
      console.log(`   ID: ${parent.id}`);
      console.log(`   Email: ${parent.email || 'None'}`);
      console.log(`   Phone: ${parent.phone_number || 'None'}`);
      console.log(`   Children: ${(parentChildrenMap[parent.id] || []).join(', ')}`);
    });
    
    // Ask for default password
    const useDefaultPassword = await question('\nUse default password "password123" for all new auth users? (yes/no): ');
    const defaultPassword = (useDefaultPassword.toLowerCase() === 'yes' || useDefaultPassword.toLowerCase() === 'y') 
      ? 'password123' 
      : await question('Enter default password for new auth users: ');
    
    if (!defaultPassword || defaultPassword.length < 6) {
      console.error('Password must be at least 6 characters long');
      rl.close();
      return;
    }
    
    // Confirm creation
    const confirmCreate = await question('\nAre you sure you want to create auth users and update these parents? (yes/no): ');
    
    if (confirmCreate.toLowerCase() !== 'yes' && confirmCreate.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      rl.close();
      return;
    }
    
    // Process each parent
    for (const parent of parentsWithChildren) {
      console.log(`\n=== Processing parent: ${parent.name} ===`);
      
      // Create a unique email if one doesn't exist
      const email = parent.email || `${parent.phone_number.replace(/[^0-9]/g, '')}@ultimateteam.app`;
      console.log(`Using email: ${email}`);
      
      // Create a unique auth user
      console.log('Creating new auth user...');
      
      // Generate a unique email by adding a timestamp if needed
      const uniqueEmail = parent.email ? 
        parent.email : 
        `${parent.phone_number.replace(/[^0-9]/g, '')}_${Date.now()}@ultimateteam.app`;
      
      // Create auth user
      const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({
        email: uniqueEmail,
        phone: parent.phone_number,
        password: defaultPassword,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          name: parent.name
        }
      });
      
      if (authError) {
        console.error('Error creating auth user:', authError);
        continue;
      }
      
      const authUser = newAuthData?.user;
      
      if (!authUser) {
        console.error('Failed to create auth user');
        continue;
      }
      
      console.log(`Created new auth user with ID: ${authUser.id}`);
      
      // Update the parent record with the auth user ID
      console.log(`Updating parent record with auth user ID: ${authUser.id}`);
      
      const { error: updateError } = await supabase
        .from('parents')
        .update({ user_id: authUser.id })
        .eq('id', parent.id);
        
      if (updateError) {
        console.error('Error updating parent record:', updateError);
      } else {
        console.log(`✅ Successfully updated parent ${parent.name} with user_id: ${authUser.id}`);
      }
    }
    
    // Verify the updates
    console.log('\n=== Verifying updates ===');
    
    const { data: updatedParents, error: verifyError } = await supabase
      .from('parents')
      .select('*')
      .in('id', parentsWithChildren.map(p => p.id));
      
    if (verifyError) {
      console.error('Error verifying updates:', verifyError);
    } else {
      console.log('Updated parents:');
      updatedParents.forEach(parent => {
        console.log(`${parent.name}: user_id = ${parent.user_id || 'None'}`);
      });
      
      const stillMissingUserId = updatedParents.filter(p => !p.user_id);
      if (stillMissingUserId.length > 0) {
        console.log(`\n⚠️ Warning: ${stillMissingUserId.length} parents still don't have user_id`);
      } else {
        console.log('\n✅ All parents now have user_id');
      }
    }
    
  } catch (err) {
    console.error('Error fixing parents:', err);
  } finally {
    rl.close();
  }
}

fixParentsWithChildren()
  .then(() => console.log('\nFinished fixing parents with children'))
  .catch(err => {
    console.error('Error running script:', err);
    rl.close();
  }); 