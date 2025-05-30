import AsyncStorage from '@react-native-async-storage/async-storage';

interface CoachData {
  id: string;           // Internal coach ID (used for database operations)
  user_id: string;      // Auth user ID (used for auth operations)
  name: string;
  phone_number: string;
  access_code: string;
  created_at: string;
  is_active: boolean;
}

/**
 * Gets the coach data from AsyncStorage
 * @returns The coach data or null if not found
 */
export const getCoachData = async (): Promise<CoachData | null> => {
  try {
    const storedCoachData = await AsyncStorage.getItem('coach_data');
    if (!storedCoachData) {
      console.log('[coachUtils] No stored coach data found');
      return null;
    }
    return JSON.parse(storedCoachData);
  } catch (error) {
    console.error('[coachUtils] Error getting coach data:', error);
    return null;
  }
};

/**
 * Gets the internal coach ID (used for database operations)
 * @returns The internal coach ID or null if not found
 */
export const getCoachInternalId = async (): Promise<string | null> => {
  const coachData = await getCoachData();
  return coachData?.id || null;
};

/**
 * Gets the auth user ID (used for auth operations)
 * @returns The auth user ID or null if not found
 */
export const getCoachAuthId = async (): Promise<string | null> => {
  const coachData = await getCoachData();
  return coachData?.user_id || null;
};

/**
 * Checks if the current user is a coach
 * @returns True if the user is a coach, false otherwise
 */
export const isCoach = async (): Promise<boolean> => {
  const coachData = await getCoachData();
  return coachData !== null;
}; 