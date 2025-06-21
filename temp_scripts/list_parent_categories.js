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

async function listParentCategories() {
  try {
    console.log('Fetching parent records...');
    
    // Get all parents without user_id
    const { data: parentsWithoutUserId, error: fetchError } = await supabase
      .from('parents')
      .select('*')
      .is('user_id', null);
      
    if (fetchError) {
      console.error('Error fetching parents:', fetchError);
      return;
    }
    
    console.log(`Found ${parentsWithoutUserId.length} parents without user_id`);
    
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
    
    // Categorize parents
    const withChildren = [];
    const withoutChildren = [];
    
    for (const parent of parentsWithoutUserId) {
      const children = parentChildrenMap[parent.id] || [];
      
      if (children.length > 0) {
        withChildren.push({
          ...parent,
          children: children
        });
      } else {
        withoutChildren.push(parent);
      }
    }
    
    // Display parents without user_id that have children
    console.log('\n=== PARENTS WITHOUT USER_ID THAT HAVE CHILDREN ===');
    console.log(`Total: ${withChildren.length}`);
    
    if (withChildren.length > 0) {
      console.log('\nDetails:');
      withChildren.forEach((parent, index) => {
        console.log(`\n${index + 1}. ${parent.name}`);
        console.log(`   ID: ${parent.id}`);
        console.log(`   Email: ${parent.email || 'None'}`);
        console.log(`   Phone: ${parent.phone_number || 'None'}`);
        console.log(`   Created: ${parent.created_at}`);
        console.log(`   Is Active: ${parent.is_active}`);
        console.log(`   Children: ${parent.children.join(', ')}`);
      });
    }
    
    // Display parents without user_id that don't have children
    console.log('\n=== PARENTS WITHOUT USER_ID THAT DON\'T HAVE CHILDREN ===');
    console.log(`Total: ${withoutChildren.length}`);
    
    if (withoutChildren.length > 0) {
      console.log('\nDetails:');
      withoutChildren.forEach((parent, index) => {
        console.log(`\n${index + 1}. ${parent.name}`);
        console.log(`   ID: ${parent.id}`);
        console.log(`   Email: ${parent.email || 'None'}`);
        console.log(`   Phone: ${parent.phone_number || 'None'}`);
        console.log(`   Created: ${parent.created_at}`);
        console.log(`   Is Active: ${parent.is_active}`);
      });
    }
    
  } catch (err) {
    console.error('Error listing parent categories:', err);
  }
}

listParentCategories()
  .then(() => console.log('\nFinished listing parent categories'))
  .catch(err => console.error('Error running script:', err)); 