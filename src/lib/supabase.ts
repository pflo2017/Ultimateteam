import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabaseKey = Constants.expoConfig?.extra?.supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your app.config.js');
}

console.log('Initializing Supabase with URL:', supabaseUrl);

const customFetch = global.fetch;
const dummyWs = { on: () => {}, send: () => {}, close: () => {} };
const supabaseOptions = { global: { fetch: customFetch, WebSocket: dummyWs } };

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  ...supabaseOptions
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