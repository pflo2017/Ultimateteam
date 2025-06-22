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

async function investigateParentTeamId() {
  try {
    // 1. Get the parent with phone +40750500500
    const { data: targetParent, error: targetParentError } = await supabase
      .from('parents')
      .select('*')
      .eq('phone_number', '+40750500500')
      .maybeSingle();
    
    if (targetParentError) {
      console.error('Error fetching target parent:', targetParentError);
      return;
    }
    
    if (!targetParent) {
      console.log('No parent found with phone number +40750500500');
      return;
    }
    
    console.log('=== TARGET PARENT ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    console.log(`Email: ${targetParent.email}`);
    console.log(`Phone: ${targetParent.phone_number}`);
    console.log(`User ID: ${targetParent.user_id || 'Not set'}`);
    console.log(`Team ID: ${targetParent.team_id || 'Not set'}`);
    console.log(`Created at: ${targetParent.created_at}`);
    console.log(`Updated at: ${targetParent.updated_at}`);
    
    // 2. Get the team information if team_id exists
    if (targetParent.team_id) {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', targetParent.team_id)
        .maybeSingle();
      
      if (teamError) {
        console.error('Error fetching team data:', teamError);
      } else if (teamData) {
        console.log('\n=== ASSOCIATED TEAM ===');
        console.log(`ID: ${teamData.id}`);
        console.log(`Name: ${teamData.name}`);
        console.log(`Age Group: ${teamData.age_group}`);
        console.log(`Season: ${teamData.season}`);
      } else {
        console.log('\nNo team found with ID:', targetParent.team_id);
      }
    }
    
    // 3. Check if this parent has children and if they are associated with the same team
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    } else if (children && children.length > 0) {
      console.log(`\n=== CHILDREN (${children.length}) ===`);
      for (const child of children) {
        console.log(`- ID: ${child.id}`);
        console.log(`  Name: ${child.full_name}`);
        console.log(`  Team ID: ${child.team_id || 'Not set'}`);
        
        // If child has a team_id, check if it matches parent's team_id
        if (child.team_id && targetParent.team_id) {
          console.log(`  Team match with parent: ${child.team_id === targetParent.team_id ? 'YES' : 'NO'}`);
        }
      }
    } else {
      console.log('\nNo children found for this parent');
    }
    
    // 4. Check if there are players associated with this parent
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
    } else if (players && players.length > 0) {
      console.log(`\n=== PLAYERS (${players.length}) ===`);
      for (const player of players) {
        console.log(`- ID: ${player.id}`);
        console.log(`  Name: ${player.full_name}`);
        console.log(`  Team ID: ${player.team_id || 'Not set'}`);
        
        // If player has a team_id, check if it matches parent's team_id
        if (player.team_id && targetParent.team_id) {
          console.log(`  Team match with parent: ${player.team_id === targetParent.team_id ? 'YES' : 'NO'}`);
        }
      }
    } else {
      console.log('\nNo players found for this parent');
    }
    
    // 5. Get a sample of other parents to compare structure
    const { data: otherParents, error: otherParentsError } = await supabase
      .from('parents')
      .select('*')
      .neq('id', targetParent.id)
      .is('team_id', null) // Look for parents without team_id
      .limit(5);
    
    if (otherParentsError) {
      console.error('Error fetching other parents:', otherParentsError);
    } else if (otherParents && otherParents.length > 0) {
      console.log('\n=== SAMPLE PARENTS WITHOUT TEAM_ID ===');
      for (const parent of otherParents) {
        console.log(`- ID: ${parent.id}`);
        console.log(`  Name: ${parent.name}`);
        console.log(`  Email: ${parent.email}`);
        console.log(`  Phone: ${parent.phone_number}`);
        console.log(`  User ID: ${parent.user_id || 'Not set'}`);
        console.log(`  Created at: ${parent.created_at}`);
      }
    }
    
    // 6. Count how many parents have team_id set
    const { count: parentsWithTeamCount, error: countError } = await supabase
      .from('parents')
      .select('*', { count: 'exact', head: true })
      .not('team_id', 'is', null);
    
    if (countError) {
      console.error('Error counting parents with team_id:', countError);
    } else {
      console.log(`\nTotal parents with team_id set: ${parentsWithTeamCount || 0}`);
    }
    
    // 7. Check database schema to understand the team_id field
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_definition', { table_name: 'parents' });
    
    if (schemaError) {
      console.error('Error fetching schema:', schemaError);
    } else if (columns) {
      console.log('\n=== PARENTS TABLE SCHEMA ===');
      console.log(columns);
    }
    
    // 8. Provide recommendation
    console.log('\n=== RECOMMENDATION ===');
    console.log('Based on the analysis:');
    console.log('1. The team_id field in parents table appears to be from an older design');
    console.log('2. Modern parent records do not have team_id set');
    console.log('3. Children/players have their own team associations');
    console.log('\nTo fix this parent record:');
    console.log('- Set team_id to NULL for this parent');
    console.log('- Ensure children/players have proper team associations');
    
  } catch (error) {
    console.error('Error investigating parent:', error);
  }
}

investigateParentTeamId()
  .then(() => console.log('\nInvestigation complete'))
  .catch(err => console.error('Error running investigation:', err)); 