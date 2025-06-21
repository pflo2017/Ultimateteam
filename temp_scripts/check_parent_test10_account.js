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

async function checkParentTest10Account() {
  try {
    console.log('Searching for the newly created parent account...');
    
    // Search by phone number first
    const phoneNumber = '+40752520520';
    console.log(`Searching by phone number: ${phoneNumber}`);
    
    const { data: parentsByPhone, error: phoneError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', phoneNumber);
      
    if (phoneError) {
      console.error('Error searching parents by phone:', phoneError);
    } else if (parentsByPhone && parentsByPhone.length > 0) {
      console.log(`Found ${parentsByPhone.length} parent(s) with phone number ${phoneNumber}`);
      await checkParents(parentsByPhone);
    } else {
      console.log(`No parents found with phone number ${phoneNumber}`);
      
      // If not found by phone, search for parents with "Test" in the name
      console.log('\nSearching for parents with "Test" in the name...');
      
      const { data: parentsByName, error: nameError } = await supabase
        .from('parents')
        .select('*')
        .ilike('name', '%Test%')
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (nameError) {
        console.error('Error searching parents by name:', nameError);
      } else if (parentsByName && parentsByName.length > 0) {
        console.log(`Found ${parentsByName.length} recent parent(s) with "Test" in the name`);
        await checkParents(parentsByName);
      } else {
        console.log('No parents found with "Test" in the name');
        
        // As a last resort, get the most recently created parents
        console.log('\nFetching the 5 most recently created parents...');
        
        const { data: recentParents, error: recentError } = await supabase
          .from('parents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
          
        if (recentError) {
          console.error('Error fetching recent parents:', recentError);
        } else if (recentParents && recentParents.length > 0) {
          console.log(`Found ${recentParents.length} recently created parents`);
          await checkParents(recentParents);
        } else {
          console.log('No parents found in the database');
        }
      }
    }
  } catch (err) {
    console.error('Error checking for parent account:', err);
  }
}

async function checkParents(parents) {
  for (const parent of parents) {
    console.log('\n----------------------------------------');
    console.log(`Examining parent: ${parent.name}`);
    console.log('----------------------------------------');
    console.log(`ID: ${parent.id}`);
    console.log(`Name: ${parent.name}`);
    console.log(`Email: ${parent.email || 'None'}`);
    console.log(`Phone: ${parent.phone_number || 'None'}`);
    console.log(`User ID: ${parent.user_id || 'None'}`);
    console.log(`Created: ${parent.created_at}`);
    
    // Check for children
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', parent.id);
      
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    } else {
      console.log(`\nChildren: ${children.length}`);
      children.forEach((child, index) => {
        console.log(`\nChild ${index + 1}:`);
        console.log(`Name: ${child.full_name || 'None'}`);
        console.log(`Team ID: ${child.team_id || 'None'}`);
      });
    }
    
    // Check for auth user with the same email
    if (parent.email) {
      console.log('\nChecking for auth user with email:', parent.email);
      
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
        filters: {
          email: parent.email
        }
      });
      
      if (authError) {
        console.error('Error checking auth users by email:', authError);
      } else {
        const authUsers = authData?.users || [];
        console.log(`Found ${authUsers.length} auth users with matching email`);
        
        authUsers.forEach((user, index) => {
          console.log(`\nAuth User ${index + 1}:`);
          console.log(`ID: ${user.id}`);
          console.log(`Email: ${user.email}`);
          console.log(`Phone: ${user.phone || 'None'}`);
          console.log(`Created: ${user.created_at}`);
          console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
          
          // Check if this auth user ID matches the parent's user_id
          if (user.id === parent.user_id) {
            console.log(`✅ This auth user ID matches parent's user_id field`);
          } else {
            console.log(`❌ This auth user ID does NOT match parent's user_id field`);
          }
        });
      }
    }
    
    // Check for auth user with the same phone
    if (parent.phone_number) {
      console.log('\nChecking for auth user with phone:', parent.phone_number);
      
      const { data: authPhoneData, error: authPhoneError } = await supabase.auth.admin.listUsers({
        filters: {
          phone: parent.phone_number
        }
      });
      
      if (authPhoneError) {
        console.error('Error checking auth users by phone:', authPhoneError);
      } else {
        const authUsers = authPhoneData?.users || [];
        console.log(`Found ${authUsers.length} auth users with matching phone`);
        
        authUsers.forEach((user, index) => {
          console.log(`\nAuth User ${index + 1}:`);
          console.log(`ID: ${user.id}`);
          console.log(`Email: ${user.email || 'None'}`);
          console.log(`Phone: ${user.phone}`);
          console.log(`Created: ${user.created_at}`);
          console.log(`Last Sign In: ${user.last_sign_in_at || 'Never'}`);
          
          // Check if this auth user ID matches the parent's user_id
          if (user.id === parent.user_id) {
            console.log(`✅ This auth user ID matches parent's user_id field`);
          } else {
            console.log(`❌ This auth user ID does NOT match parent's user_id field`);
          }
        });
      }
    }
    
    // If parent has user_id but we didn't find a matching auth user yet, try to fetch it directly
    if (parent.user_id) {
      console.log(`\nChecking for auth user with ID: ${parent.user_id}`);
      
      const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(
        parent.user_id
      );
      
      if (authUserError) {
        console.error('Error fetching auth user by ID:', authUserError);
      } else if (authUser && authUser.user) {
        console.log(`\nFound auth user by ID:`);
        console.log(`ID: ${authUser.user.id}`);
        console.log(`Email: ${authUser.user.email || 'None'}`);
        console.log(`Phone: ${authUser.user.phone || 'None'}`);
        console.log(`Created: ${authUser.user.created_at}`);
        console.log(`Last Sign In: ${authUser.user.last_sign_in_at || 'Never'}`);
      } else {
        console.log(`No auth user found with ID: ${parent.user_id}`);
      }
    }
  }
}

checkParentTest10Account()
  .then(() => console.log('\nFinished checking parent accounts'))
  .catch(err => console.error('Error running script:', err)); 