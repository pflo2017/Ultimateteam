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

async function linkChildrenToPlayers() {
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
    
    console.log('=== PARENT INFO ===');
    console.log(`ID: ${targetParent.id}`);
    console.log(`Name: ${targetParent.name}`);
    
    // 2. Get the children from parent_children table
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
      return;
    }
    
    if (!children || children.length === 0) {
      console.log('No children found for this parent');
      return;
    }
    
    console.log(`Found ${children.length} children for parent`);
    
    // 3. Get players associated with this parent
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players:', playersError);
      return;
    }
    
    if (!players || players.length === 0) {
      console.log('No players found for this parent');
      return;
    }
    
    console.log(`Found ${players.length} players for parent`);
    
    // 4. Link children to players and update player names
    console.log('\n=== LINKING CHILDREN TO PLAYERS ===');
    
    for (let i = 0; i < Math.min(children.length, players.length); i++) {
      const child = children[i];
      const player = players[i];
      
      console.log(`\nLinking child "${child.full_name}" to player "${player.name || 'unnamed'}"`);
      
      // Update the player_id in the parent_children table
      const { error: childUpdateError } = await supabase
        .from('parent_children')
        .update({ player_id: player.id })
        .eq('id', child.id);
      
      if (childUpdateError) {
        console.error(`Error updating child ${child.id}:`, childUpdateError);
      } else {
        console.log(`✅ Successfully linked child to player`);
      }
      
      // Update the player name to match the child's name
      const { error: playerUpdateError } = await supabase
        .from('players')
        .update({ name: child.full_name })
        .eq('id', player.id);
      
      if (playerUpdateError) {
        console.error(`Error updating player ${player.id}:`, playerUpdateError);
      } else {
        console.log(`✅ Successfully updated player name to "${child.full_name}"`);
      }
    }
    
    // 5. Verify the updates
    console.log('\n=== VERIFYING UPDATES ===');
    
    // Check updated children
    const { data: updatedChildren, error: verifyChildrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (verifyChildrenError) {
      console.error('Error verifying children updates:', verifyChildrenError);
    } else if (updatedChildren && updatedChildren.length > 0) {
      console.log('\nUpdated children:');
      updatedChildren.forEach(child => {
        console.log(`- Child "${child.full_name}" linked to player ID: ${child.player_id || 'Not linked'}`);
      });
    }
    
    // Check updated players
    const { data: updatedPlayers, error: verifyPlayersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (verifyPlayersError) {
      console.error('Error verifying player updates:', verifyPlayersError);
    } else if (updatedPlayers && updatedPlayers.length > 0) {
      console.log('\nUpdated players:');
      updatedPlayers.forEach(player => {
        console.log(`- Player ID ${player.id}: "${player.name}"`);
      });
    }
    
    console.log('\n✅ Successfully linked children to players');
    
  } catch (error) {
    console.error('Error linking children to players:', error);
  }
}

linkChildrenToPlayers()
  .then(() => console.log('\nLink process complete'))
  .catch(err => console.error('Error running link process:', err)); 