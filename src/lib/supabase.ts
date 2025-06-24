import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabasePublishableKey = Constants.expoConfig?.extra?.supabasePublishableKey;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase configuration. Please check your app.config.js');
}

console.log('Initializing Supabase with URL:', supabaseUrl);

const customFetch = global.fetch;
const dummyWs = { on: () => {}, send: () => {}, close: () => {} };
const supabaseOptions = { global: { fetch: customFetch, WebSocket: dummyWs } };

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AsyncStorage,
  },
  ...supabaseOptions
});

// Set up auth state change listener to handle token refresh
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Supabase auth state changed:', event);
  
  if (event === 'TOKEN_REFRESHED') {
    console.log('JWT token was refreshed successfully');
  }
  
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    // Clear any local storage items related to the user
    AsyncStorage.multiRemove(['admin_data', 'coach_data', 'parent_data', 'clubId', 'clubName']);
  }
});

// Function to manually refresh the token if needed
export const refreshToken = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
    
    console.log('Token refreshed successfully:', data.session?.expires_at);
    return true;
  } catch (error) {
    console.error('Exception during token refresh:', error);
    return false;
  }
};

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