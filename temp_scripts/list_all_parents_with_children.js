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

async function listAllParentsWithChildren() {
  try {
    console.log('Fetching all parent records...');
    
    // Get all parents
    const { data: allParents, error: fetchError } = await supabase
      .from('parents')
      .select('*');
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      return;
    }
    
    console.log(`Found ${allParents.length} total parents`);
    
    // Get all parent-children relationships
    const { data: allParentChildren, error: pcError } = await supabase
      .from('parent_children')
      .select('parent_id, full_name, team_id');
      
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
      parentChildrenMap[pc.parent_id].push({
        name: pc.full_name,
        team_id: pc.team_id
      });
    }
    
    // Filter parents with children
    const parentsWithChildren = allParents.filter(parent => 
      parentChildrenMap[parent.id] && parentChildrenMap[parent.id].length > 0
    );
    
    // Categorize parents with children by whether they have user_id
    const withUserId = [];
    const withoutUserId = [];
    
    for (const parent of parentsWithChildren) {
      const children = parentChildrenMap[parent.id] || [];
      
      const parentWithChildren = {
        ...parent,
        children: children
      };
      
      if (parent.user_id) {
        withUserId.push(parentWithChildren);
      } else {
        withoutUserId.push(parentWithChildren);
      }
    }
    
    // Display parents with children that have user_id
    console.log(`\nFound ${withUserId.length} parents with children that have user_id`);
    
    if (withUserId.length > 0) {
      console.log('\n=== PARENTS WITH CHILDREN THAT HAVE USER_ID ===');
      withUserId.forEach((parent, index) => {
        console.log(`\n${index + 1}. ${parent.name}`);
        console.log(`   ID: ${parent.id}`);
        console.log(`   Email: ${parent.email || 'None'}`);
        console.log(`   Phone: ${parent.phone_number || 'None'}`);
        console.log(`   User ID: ${parent.user_id}`);
        console.log(`   Children: ${parent.children.map(c => c.name).join(', ')}`);
      });
    }
    
    // Display parents with children that don't have user_id
    console.log(`\nFound ${withoutUserId.length} parents with children that don't have user_id`);
    
    if (withoutUserId.length > 0) {
      console.log('\n=== PARENTS WITH CHILDREN THAT DON\'T HAVE USER_ID ===');
      withoutUserId.forEach((parent, index) => {
        console.log(`\n${index + 1}. ${parent.name}`);
        console.log(`   ID: ${parent.id}`);
        console.log(`   Email: ${parent.email || 'None'}`);
        console.log(`   Phone: ${parent.phone_number || 'None'}`);
        console.log(`   Children: ${parent.children.map(c => c.name).join(', ')}`);
      });
    }
    
  } catch (err) {
    console.error('Error listing parents:', err);
  }
}

listAllParentsWithChildren()
  .then(() => console.log('\nFinished listing all parents with children'))
  .catch(err => console.error('Error running script:', err)); 