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

async function linkExistingAuthUsers() {
  try {
    console.log('Fetching parents without user_id...');
    
    // Get parents without user_id
    const { data: parentsWithoutUserId, error: fetchError } = await supabase
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
    const parentsWithChildren = parentsWithoutUserId.filter(parent => 
      parentChildrenMap[parent.id] && parentChildrenMap[parent.id].length > 0
    );
    
    console.log(`\nFound ${parentsWithChildren.length} parents with children that don't have user_id`);
    
    if (parentsWithChildren.length === 0) {
      console.log('No parents to link.');
      rl.close();
      return;
    }
    
    // Get all auth users
    console.log('\nFetching all auth users...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      rl.close();
      return;
    }
    
    const authUsers = authData?.users || [];
    console.log(`Found ${authUsers.length} auth users`);
    
    // Define known mappings based on our previous findings
    const knownMappings = [
      {
        parentId: 'cb1e61f6-1f09-456e-a95a-c737264e400f', // Marin marin
        authUserId: '6e8c19ef-4dd9-4496-9bd2-71f095492289'
      },
      {
        parentId: '15912ed2-d558-4954-9e7a-34f1c11b4e24', // Denis Petre
        authUserId: '47829833-0778-4d7e-9f2d-14ebdce94ca7'
      },
      {
        parentId: 'c6b68eec-9bc3-4c60-926d-2bee620c65c4', // Grigore Sorin
        authUserId: 'b2747220-b50c-4f8e-aa18-fb37bfc82d77'
      }
      // Parent test doesn't have a clear match
    ];
    
    // Display the mappings
    console.log('\n=== PARENT TO AUTH USER MAPPINGS ===');
    
    for (const mapping of knownMappings) {
      const parent = parentsWithChildren.find(p => p.id === mapping.parentId);
      const authUser = authUsers.find(u => u.id === mapping.authUserId);
      
      if (parent && authUser) {
        console.log(`\nParent: ${parent.name}`);
        console.log(`   ID: ${parent.id}`);
        console.log(`   Email: ${parent.email || 'None'}`);
        console.log(`   Phone: ${parent.phone_number || 'None'}`);
        console.log(`Will be linked to Auth User:`);
        console.log(`   ID: ${authUser.id}`);
        console.log(`   Email: ${authUser.email || 'None'}`);
        console.log(`   Phone: ${authUser.phone || 'None'}`);
        console.log(`   Created: ${authUser.created_at}`);
        console.log(`   Last Sign In: ${authUser.last_sign_in_at || 'Never'}`);
      }
    }
    
    // Handle Parent test separately
    const parentTest = parentsWithChildren.find(p => p.name === 'Parent test');
    if (parentTest) {
      console.log(`\nParent: ${parentTest.name}`);
      console.log(`   ID: ${parentTest.id}`);
      console.log(`   Email: ${parentTest.email || 'None'}`);
      console.log(`   Phone: ${parentTest.phone_number || 'None'}`);
      console.log(`No existing auth user found. Will need to create a new one.`);
    }
    
    // Confirm the mappings
    const confirmMappings = await question('\nDo you want to apply these mappings? (yes/no): ');
    
    if (confirmMappings.toLowerCase() !== 'yes' && confirmMappings.toLowerCase() !== 'y') {
      console.log('Operation cancelled.');
      rl.close();
      return;
    }
    
    // Apply the mappings
    console.log('\nApplying mappings...');
    
    for (const mapping of knownMappings) {
      console.log(`\nUpdating parent ${mapping.parentId} with auth user ${mapping.authUserId}`);
      
      const { error: updateError } = await supabase
        .from('parents')
        .update({ user_id: mapping.authUserId })
        .eq('id', mapping.parentId);
        
      if (updateError) {
        console.error(`Error updating parent ${mapping.parentId}:`, updateError);
      } else {
        console.log(`✅ Successfully updated parent ${mapping.parentId}`);
      }
    }
    
    // Handle Parent test - ask if user wants to create a new auth user
    if (parentTest) {
      const createNew = await question(`\nDo you want to create a new auth user for '${parentTest.name}'? (yes/no): `);
      
      if (createNew.toLowerCase() === 'yes' || createNew.toLowerCase() === 'y') {
        const password = await question('Enter password for the new auth user (min 6 characters): ');
        
        if (!password || password.length < 6) {
          console.error('Password must be at least 6 characters long');
        } else {
          console.log('Creating new auth user...');
          
          const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({
            email: parentTest.email,
            phone: parentTest.phone_number,
            password: password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
              name: parentTest.name
            }
          });
          
          if (authError) {
            console.error('Error creating auth user:', authError);
          } else {
            const authUser = newAuthData?.user;
            
            if (!authUser) {
              console.error('Failed to create auth user');
            } else {
              console.log(`Created new auth user with ID: ${authUser.id}`);
              
              // Update the parent record
              const { error: updateError } = await supabase
                .from('parents')
                .update({ user_id: authUser.id })
                .eq('id', parentTest.id);
                
              if (updateError) {
                console.error('Error updating parent record:', updateError);
              } else {
                console.log(`✅ Successfully updated parent ${parentTest.name} with user_id: ${authUser.id}`);
              }
            }
          }
        }
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
        stillMissingUserId.forEach(parent => {
          console.log(`   ${parent.name} (${parent.email || parent.phone_number})`);
        });
      } else {
        console.log('\n✅ All parents now have user_id');
      }
    }
    
  } catch (err) {
    console.error('Error linking auth users:', err);
  } finally {
    rl.close();
  }
}

linkExistingAuthUsers()
  .then(() => console.log('\nFinished linking auth users'))
  .catch(err => {
    console.error('Error running script:', err);
    rl.close();
  }); 