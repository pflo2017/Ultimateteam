import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

console.log('Initializing Supabase with URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: { 'x-disable-cache': 'true' }
  }
});

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