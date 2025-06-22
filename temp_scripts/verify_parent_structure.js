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

async function verifyParentStructure() {
  try {
    // 1. Get the fixed parent with phone +40750500500
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
    
    console.log('=== FIXED PARENT ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    console.log(`Email: ${targetParent.email}`);
    console.log(`Phone: ${targetParent.phone_number}`);
    console.log(`User ID: ${targetParent.user_id || 'Not set'}`);
    console.log(`Team ID: ${targetParent.team_id || 'Not set'} (Should be null/Not set)`);
    console.log(`Created at: ${targetParent.created_at}`);
    console.log(`Updated at: ${targetParent.updated_at}`);
    
    // 2. Get a sample of other working parents for comparison
    const { data: otherParents, error: otherParentsError } = await supabase
      .from('parents')
      .select('*')
      .neq('id', targetParent.id)
      .is('team_id', null) // Look for parents without team_id
      .limit(1);
    
    if (otherParentsError) {
      console.error('Error fetching other parents:', otherParentsError);
    } else if (otherParents && otherParents.length > 0) {
      console.log('\n=== SAMPLE WORKING PARENT FOR COMPARISON ===');
      const sampleParent = otherParents[0];
      console.log(`ID: ${sampleParent.id}`);
      console.log(`Name: ${sampleParent.name}`);
      console.log(`Email: ${sampleParent.email}`);
      console.log(`Phone: ${sampleParent.phone_number}`);
      console.log(`User ID: ${sampleParent.user_id || 'Not set'}`);
      console.log(`Team ID: ${sampleParent.team_id || 'Not set'}`);
      console.log(`Created at: ${sampleParent.created_at}`);
      console.log(`Updated at: ${sampleParent.updated_at}`);
    }
    
    // 3. Get the children for the fixed parent
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
    } else if (children && children.length > 0) {
      console.log(`\n=== CHILDREN FOR FIXED PARENT (${children.length}) ===`);
      for (const child of children) {
        console.log(`- ID: ${child.id}`);
        console.log(`  Name: ${child.full_name}`);
        console.log(`  Birth Date: ${child.birth_date}`);
        console.log(`  Team ID: ${child.team_id || 'Not set'}`);
        console.log(`  Player ID: ${child.player_id || 'Not set'}`);
      }
    }
    
    // 4. Get the players for the fixed parent
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
    } else if (players && players.length > 0) {
      console.log(`\n=== PLAYERS FOR FIXED PARENT (${players.length}) ===`);
      for (const player of players) {
        console.log(`- ID: ${player.id}`);
        console.log(`  Name: ${player.name}`);
        console.log(`  Team ID: ${player.team_id || 'Not set'}`);
      }
    }
    
    // 5. Verify the auth account for the fixed parent
    if (targetParent.user_id) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
        targetParent.user_id
      );
      
      if (authError) {
        console.error('Error fetching auth user:', authError);
      } else if (authUser) {
        console.log('\n=== AUTH ACCOUNT FOR FIXED PARENT ===');
        console.log(`ID: ${authUser.user.id}`);
        console.log(`Email: ${authUser.user.email}`);
        console.log(`Phone: ${authUser.user.phone}`);
        console.log(`Created at: ${authUser.user.created_at}`);
        console.log(`Last sign in: ${authUser.user.last_sign_in_at}`);
      }
    }
    
    // 6. Check if there are any remaining parents with team_id set
    const { count: parentsWithTeamCount, error: countError } = await supabase
      .from('parents')
      .select('*', { count: 'exact', head: true })
      .not('team_id', 'is', null);
    
    if (countError) {
      console.error('Error counting parents with team_id:', countError);
    } else {
      console.log(`\nTotal parents with team_id set: ${parentsWithTeamCount || 0} (Should be 0)`);
    }
    
    // 7. Final verdict
    console.log('\n=== VERIFICATION RESULT ===');
    
    const issues = [];
    
    if (targetParent.team_id !== null) {
      issues.push('❌ Parent still has team_id set');
    }
    
    if (!targetParent.user_id) {
      issues.push('❌ Parent has no user_id set');
    }
    
    if (!children || children.length === 0) {
      issues.push('❌ Parent has no children records');
    } else {
      const unlinkedChildren = children.filter(child => !child.player_id);
      if (unlinkedChildren.length > 0) {
        issues.push(`❌ ${unlinkedChildren.length} children not linked to players`);
      }
    }
    
    if (!players || players.length === 0) {
      issues.push('❌ Parent has no player records');
    }
    
    if (issues.length === 0) {
      console.log('✅ Parent record is now properly structured!');
      console.log('✅ All children are linked to players');
      console.log('✅ No team_id is set on parent record');
      console.log('✅ Parent has a valid user_id for authentication');
    } else {
      console.log('Issues found:');
      issues.forEach(issue => console.log(issue));
    }
    
  } catch (error) {
    console.error('Error verifying parent structure:', error);
  }
}

verifyParentStructure()
  .then(() => console.log('\nVerification complete'))
  .catch(err => console.error('Error running verification:', err)); 