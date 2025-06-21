const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

async function checkAuthUsers() {
  try {
    console.log('Fetching parents without user_id...');
    
    // Get parents without user_id
    const { data: parentsWithoutUserId, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .is('user_id', null);
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      return;
    }
    
    // Get all parent-children relationships
    const { data: allParentChildren, error: pcError } = await supabase
      .from('parent_children')
      .select('parent_id, full_name');
      
    if (pcError) {
      console.error('Error fetching parent-children relationships:', pcError);
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
      console.log('No parents to check.');
      return;
    }
    
    // Display parents to check
    console.log('\n=== PARENTS TO CHECK ===');
    parentsWithChildren.forEach((parent, index) => {
      console.log(`\n${index + 1}. ${parent.name}`);
      console.log(`   ID: ${parent.id}`);
      console.log(`   Email: ${parent.email || 'None'}`);
      console.log(`   Phone: ${parent.phone_number || 'None'}`);
      console.log(`   Children: ${(parentChildrenMap[parent.id] || []).join(', ')}`);
    });
    
    // Get all auth users
    console.log('\nFetching all auth users...');
    
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }
    
    const authUsers = authData?.users || [];
    console.log(`Found ${authUsers.length} auth users`);
    
    // Check for potential matches by email or phone
    console.log('\nChecking for potential auth matches...');
    
    for (const parent of parentsWithChildren) {
      console.log(`\n=== Checking for auth user for parent: ${parent.name} ===`);
      
      // Check by email
      if (parent.email) {
        console.log(`Checking for auth user with email: ${parent.email}`);
        
        const emailMatches = authUsers.filter(user => 
          user.email && user.email.toLowerCase() === parent.email.toLowerCase()
        );
        
        if (emailMatches.length > 0) {
          console.log(`✅ Found ${emailMatches.length} auth user(s) with matching email:`);
          emailMatches.forEach((user, idx) => {
            console.log(`   User ${idx + 1}:`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Phone: ${user.phone || 'None'}`);
            console.log(`   Created: ${user.created_at}`);
            console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
          });
        } else {
          console.log(`❌ No auth users found with email: ${parent.email}`);
        }
      }
      
      // Check by phone
      if (parent.phone_number) {
        console.log(`Checking for auth user with phone: ${parent.phone_number}`);
        
        const phoneMatches = authUsers.filter(user => 
          user.phone && user.phone === parent.phone_number
        );
        
        if (phoneMatches.length > 0) {
          console.log(`✅ Found ${phoneMatches.length} auth user(s) with matching phone:`);
          phoneMatches.forEach((user, idx) => {
            console.log(`   User ${idx + 1}:`);
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email || 'None'}`);
            console.log(`   Phone: ${user.phone}`);
            console.log(`   Created: ${user.created_at}`);
            console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
          });
        } else {
          console.log(`❌ No auth users found with phone: ${parent.phone_number}`);
        }
      }
      
      // Check for similar email (case insensitive, partial match)
      if (parent.email) {
        const emailParts = parent.email.split('@');
        if (emailParts.length === 2) {
          const emailUsername = emailParts[0].toLowerCase();
          
          console.log(`Checking for auth users with similar email username: ${emailUsername}`);
          
          const similarEmailMatches = authUsers.filter(user => 
            user.email && user.email.toLowerCase().includes(emailUsername)
          );
          
          if (similarEmailMatches.length > 0) {
            console.log(`Found ${similarEmailMatches.length} auth user(s) with similar email:`);
            similarEmailMatches.forEach((user, idx) => {
              console.log(`   User ${idx + 1}:`);
              console.log(`   ID: ${user.id}`);
              console.log(`   Email: ${user.email}`);
              console.log(`   Phone: ${user.phone || 'None'}`);
              console.log(`   Created: ${user.created_at}`);
            });
          }
        }
      }
    }
    
    // Check for parents with user_id that might be duplicates
    console.log('\n=== Checking for potential duplicate parents ===');
    
    const { data: parentsWithUserId, error: dupError } = await supabase
      .from('parents')
      .select('*')
      .not('user_id', 'is', null);
      
    if (dupError) {
      console.error('Error fetching parents with user_id:', dupError);
      return;
    }
    
    for (const parent of parentsWithChildren) {
      console.log(`\nChecking for potential duplicates of: ${parent.name}`);
      
      // Check by email
      if (parent.email) {
        const emailDuplicates = parentsWithUserId.filter(p => 
          p.email && p.email.toLowerCase() === parent.email.toLowerCase()
        );
        
        if (emailDuplicates.length > 0) {
          console.log(`⚠️ Found ${emailDuplicates.length} parent(s) with same email but with user_id:`);
          emailDuplicates.forEach((p, idx) => {
            console.log(`   Parent ${idx + 1}:`);
            console.log(`   ID: ${p.id}`);
            console.log(`   Name: ${p.name}`);
            console.log(`   Email: ${p.email}`);
            console.log(`   User ID: ${p.user_id}`);
          });
        }
      }
      
      // Check by phone
      if (parent.phone_number) {
        const phoneDuplicates = parentsWithUserId.filter(p => 
          p.phone_number && p.phone_number === parent.phone_number
        );
        
        if (phoneDuplicates.length > 0) {
          console.log(`⚠️ Found ${phoneDuplicates.length} parent(s) with same phone but with user_id:`);
          phoneDuplicates.forEach((p, idx) => {
            console.log(`   Parent ${idx + 1}:`);
            console.log(`   ID: ${p.id}`);
            console.log(`   Name: ${p.name}`);
            console.log(`   Phone: ${p.phone_number}`);
            console.log(`   User ID: ${p.user_id}`);
          });
        }
      }
      
      // Check by similar name
      const nameParts = parent.name.toLowerCase().split(' ');
      const similarNames = parentsWithUserId.filter(p => {
        if (!p.name) return false;
        const pName = p.name.toLowerCase();
        return nameParts.some(part => part.length > 2 && pName.includes(part));
      });
      
      if (similarNames.length > 0) {
        console.log(`Found ${similarNames.length} parent(s) with similar name and with user_id:`);
        similarNames.forEach((p, idx) => {
          console.log(`   Parent ${idx + 1}:`);
          console.log(`   ID: ${p.id}`);
          console.log(`   Name: ${p.name}`);
          console.log(`   Email: ${p.email || 'None'}`);
          console.log(`   Phone: ${p.phone_number || 'None'}`);
          console.log(`   User ID: ${p.user_id}`);
        });
      }
    }
    
  } catch (err) {
    console.error('Error checking auth users:', err);
  }
}

checkAuthUsers()
  .then(() => console.log('\nFinished checking auth users'))
  .catch(err => console.error('Error running script:', err)); 