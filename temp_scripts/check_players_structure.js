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

async function checkPlayersStructure() {
  try {
    // 1. Get a sample player to see the structure
    const { data: samplePlayer, error: playerError } = await supabase
      .from('players')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (playerError) {
      console.error('Error fetching player:', playerError);
      return;
    }
    
    if (!samplePlayer) {
      console.log('No players found in the database');
      return;
    }
    
    console.log('=== PLAYERS TABLE STRUCTURE ===');
    console.log('Columns:', Object.keys(samplePlayer).join(', '));
    console.log('\nSample player data:');
    console.log(JSON.stringify(samplePlayer, null, 2));
    
    // 2. Check if there's a name field with a different name
    const nameFields = Object.keys(samplePlayer).filter(key => 
      key.toLowerCase().includes('name') || 
      key.toLowerCase().includes('player') ||
      key.toLowerCase().includes('person')
    );
    
    if (nameFields.length > 0) {
      console.log('\nPossible name fields:', nameFields.join(', '));
    }
    
    // 3. Check if there are players for the parent with phone +40750500500
    const { data: targetParent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('phone_number', '+40750500500')
      .maybeSingle();
    
    if (parentError) {
      console.error('Error fetching parent:', parentError);
      return;
    }
    
    if (!targetParent) {
      console.log('Parent with phone +40750500500 not found');
      return;
    }
    
    const { data: parentPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (playersError) {
      console.error('Error fetching players for parent:', playersError);
      return;
    }
    
    console.log(`\n=== PLAYERS FOR PARENT +40750500500 (${parentPlayers.length}) ===`);
    parentPlayers.forEach((player, index) => {
      console.log(`\nPlayer ${index + 1}:`);
      console.log(JSON.stringify(player, null, 2));
    });
    
    // 4. Check the parent_children table for the same parent
    const { data: children, error: childrenError } = await supabase
      .from('parent_children')
      .select('*')
      .eq('parent_id', targetParent.id);
    
    if (childrenError) {
      console.error('Error fetching children:', childrenError);
      return;
    }
    
    console.log(`\n=== CHILDREN FOR PARENT +40750500500 (${children?.length || 0}) ===`);
    if (children && children.length > 0) {
      children.forEach((child, index) => {
        console.log(`\nChild ${index + 1}:`);
        console.log(JSON.stringify(child, null, 2));
      });
    } else {
      console.log('No children found for this parent');
    }
    
    // 5. Check if there's a relationship between parent_children and players
    if (children && children.length > 0 && parentPlayers && parentPlayers.length > 0) {
      console.log('\n=== CHECKING RELATIONSHIPS ===');
      
      // Check if player_id exists in parent_children
      const childrenWithPlayerId = children.filter(child => child.player_id);
      console.log(`Children with player_id set: ${childrenWithPlayerId.length}`);
      
      // Check if any player_id in children matches player ids
      const matchingPlayers = childrenWithPlayerId.filter(child => 
        parentPlayers.some(player => player.id === child.player_id)
      );
      
      console.log(`Children with matching player_id: ${matchingPlayers.length}`);
      
      if (matchingPlayers.length > 0) {
        console.log('\nMatched children to players:');
        matchingPlayers.forEach(child => {
          const matchedPlayer = parentPlayers.find(p => p.id === child.player_id);
          console.log(`- Child "${child.full_name}" matches player ID ${matchedPlayer.id}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking players structure:', error);
  }
}

checkPlayersStructure()
  .then(() => console.log('\nCheck complete'))
  .catch(err => console.error('Error running check:', err)); 