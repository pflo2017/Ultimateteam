import { supabase } from '../lib/supabase';

/**
 * Validates player IDs and returns only valid ones
 * @param playerIds Array of player IDs to validate
 * @returns Array of valid player IDs
 */
export const validatePlayerIds = async (playerIds: string[]): Promise<string[]> => {
  if (!playerIds || playerIds.length === 0) return [];
  
  const { data: validPlayers, error } = await supabase
    .from('players')
    .select('id')
    .in('id', playerIds);
    
  if (error) {
    console.error('Error validating player IDs:', error);
    throw error;
  }
  
  // Return only valid player IDs
  return validPlayers.map(p => p.id);
};

/**
 * Filters out invalid players from lineup data
 * @param lineupPlayers Array of player objects with id and name
 * @returns Filtered array with only valid players
 */
export const filterValidPlayers = (lineupPlayers: { id: string; name: string }[]): { id: string; name: string }[] => {
  return lineupPlayers.filter(player => 
    player.name && 
    player.name !== player.id && 
    player.name.trim() !== ''
  );
}; 