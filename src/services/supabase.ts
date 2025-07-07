import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
const supabasePublishableKey = Constants.expoConfig?.extra?.supabasePublishableKey;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase configuration. Please check your app.config.js');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey); 