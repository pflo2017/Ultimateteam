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
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_KEY || "REMOVED_FOR_SECURITY"';

console.log('Using Supabase URL:', SUPABASE_URL);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function checkSpecificParentAndChildren() {
  try {
    // 1. Check for the specific parent with phone +40710100100
    console.log('Checking for parent with phone +40710100100...');
    
    const { data: specificParent, error: parentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', '+40710100100');
      
    if (parentError) {
      console.error('Error fetching specific parent:', parentError);
      return;
    }
    
    if (!specificParent || specificParent.length === 0) {
      console.log('No parent found with phone number +40710100100');
    } else {
      console.log(`Found ${specificParent.length} parent(s) with phone +40710100100:`);
      specificParent.forEach((parent, index) => {
        console.log(`\nParent ${index + 1}:`);
        console.log(`ID: ${parent.id}`);
        console.log(`Name: ${parent.name}`);
        console.log(`Email: ${parent.email || 'None'}`);
        console.log(`Phone: ${parent.phone_number}`);
        console.log(`User ID: ${parent.user_id || 'None'}`);
        console.log(`Is Active: ${parent.is_active}`);
        console.log(`Created: ${parent.created_at}`);
      });
    }
    
    // 2. Check the parent_children table structure
    console.log('\nChecking parent_children table structure...');
    
    // Get a sample of parent_children records
    const { data: sampleRecords, error: sampleError } = await supabase
      .from('parent_children')
      .select('*')
      .limit(5);
      
    if (sampleError) {
      console.error('Error fetching sample parent_children records:', sampleError);
      return;
    }
    
    if (!sampleRecords || sampleRecords.length === 0) {
      console.log('No records found in parent_children table');
    } else {
      console.log('Sample parent_children record structure:');
      console.log(JSON.stringify(sampleRecords[0], null, 2));
      
      console.log(`\nFound ${sampleRecords.length} sample records in parent_children table`);
    }
    
    // 3. Check all records in parent_children table
    console.log('\nChecking all records in parent_children table...');
    
    const { data: allRecords, error: allError } = await supabase
      .from('parent_children')
      .select('*');
      
    if (allError) {
      console.error('Error fetching all parent_children records:', allError);
      return;
    }
    
    console.log(`Found ${allRecords.length} total records in parent_children table`);
    
    // 4. Check for any children associated with phone +40710100100
    console.log('\nChecking for children associated with phone +40710100100...');
    
    // First, try to find the parent ID if it exists
    let parentId = null;
    if (specificParent && specificParent.length > 0) {
      parentId = specificParent[0].id;
      
      // Check for children with this parent ID
      const { data: childrenRecords, error: childrenError } = await supabase
        .from('parent_children')
        .select('*')
        .eq('parent_id', parentId);
        
      if (childrenError) {
        console.error('Error fetching children records:', childrenError);
      } else if (!childrenRecords || childrenRecords.length === 0) {
        console.log(`No children found for parent ID ${parentId}`);
      } else {
        console.log(`Found ${childrenRecords.length} children for parent ID ${parentId}:`);
        childrenRecords.forEach((child, index) => {
          console.log(`\nChild ${index + 1}:`);
          console.log(`ID: ${child.id}`);
          console.log(`Name: ${child.full_name || 'None'}`);
          console.log(`Team ID: ${child.team_id || 'None'}`);
        });
      }
    } else {
      // If we didn't find the parent by phone, let's check if there are any other ways
      // the parent might be identified in the parent_children table
      console.log('Searching for alternative ways to identify the parent in parent_children table...');
      
      // Check if there's a phone_number field in the parent_children table
      if (sampleRecords && sampleRecords.length > 0 && sampleRecords[0].phone_number) {
        const { data: phoneChildrenRecords, error: phoneChildrenError } = await supabase
          .from('parent_children')
          .select('*')
          .eq('phone_number', '+40710100100');
          
        if (phoneChildrenError) {
          console.error('Error searching by phone in parent_children:', phoneChildrenError);
        } else if (phoneChildrenRecords && phoneChildrenRecords.length > 0) {
          console.log(`Found ${phoneChildrenRecords.length} records by phone in parent_children`);
          console.log(JSON.stringify(phoneChildrenRecords, null, 2));
        } else {
          console.log('No records found by phone in parent_children');
        }
      }
    }
    
    // 5. Check if there might be a different phone format
    console.log('\nChecking for similar phone numbers...');
    
    const { data: similarPhones, error: similarError } = await supabase
      .from('parents')
      .select('*')
      .like('phone_number', '%710100100%');
      
    if (similarError) {
      console.error('Error searching for similar phones:', similarError);
    } else if (similarPhones && similarPhones.length > 0) {
      console.log(`Found ${similarPhones.length} parents with similar phone numbers:`);
      similarPhones.forEach((parent, index) => {
        console.log(`\nParent ${index + 1}:`);
        console.log(`ID: ${parent.id}`);
        console.log(`Name: ${parent.name}`);
        console.log(`Phone: ${parent.phone_number}`);
      });
    } else {
      console.log('No parents found with similar phone numbers');
    }
    
  } catch (err) {
    console.error('Error during check:', err);
  }
}

checkSpecificParentAndChildren()
  .then(() => console.log('\nFinished checking parent and children'))
  .catch(err => console.error('Error running script:', err)); 