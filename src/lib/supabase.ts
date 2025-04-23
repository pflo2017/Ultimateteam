import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

console.log('Initializing Supabase with URL:', SUPABASE_URL);

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

// Test the connection
(async () => {
  try {
    const response = await supabase
      .from('teams')
      .select('count')
      .limit(1);
    console.log('Supabase connection test response:', response);
  } catch (error: unknown) {
    console.error('Supabase connection test error:', error);
  }
})(); 