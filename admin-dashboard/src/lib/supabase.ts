import { createClient } from '@supabase/supabase-js';

// Get the Supabase URL and key from environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.REACT_APP_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required. Please check your .env file.');
}

console.log('Using Supabase URL:', supabaseUrl);
console.log('Using service key:', supabaseServiceKey ? 'Yes' : 'No');

// Create the standard client with anon key and auto refresh token enabled
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
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
    localStorage.removeItem('clubId');
    localStorage.removeItem('clubName');
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

// Create an admin client with service role key if available
export const adminSupabase = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase; // Fall back to regular client if no service key

// Helper function to get authenticated user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to check if user is a master admin
export const isMasterAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Checking if user is master admin:', user.id);
    
    // Try to get the master admin record
    const { data, error } = await supabase
      .from('master_admins')
      .select('*')
      .eq('user_id', user.id);
      
    console.log('Master admin check result:', { data, error });
    
    // Return true if we found at least one record and no error
    return Array.isArray(data) && data.length > 0 && !error;
  } catch (error) {
    console.error('Error checking master admin status:', error);
    return false;
  }
};

// Helper function to check if user is a super admin
export const isSuperAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Checking if user is super admin:', user.id);
    
    // Try to get the master admin record with super admin flag
    const { data, error } = await supabase
      .from('master_admins')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_super_admin', true);
      
    console.log('Super admin check result:', { data, error });
    
    // Return true if we found at least one record and no error
    return Array.isArray(data) && data.length > 0 && !error;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
};

// Helper function to check if user is a club admin
export const isClubAdmin = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return false;
    }
    
    console.log('Checking if user is club admin:', user.id);
    
    // Check if the user is a club admin by looking in the clubs table
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name')
      .eq('admin_id', user.id);
      
    console.log('Club admin check result:', { data, error });
    
    // Return true if we found at least one record and no error
    return Array.isArray(data) && data.length > 0 && !error;
  } catch (error) {
    console.error('Error checking club admin status:', error);
    return false;
  }
};

// Helper function to get the club ID for a club admin
export const getClubAdminClubId = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }
    
    console.log('Getting club ID for club admin:', user.id);
    
    // Get the club ID from the clubs table
    const { data, error } = await supabase
      .from('clubs')
      .select('id')
      .eq('admin_id', user.id)
      .single();
      
    if (error) {
      console.error('Error getting club ID:', error);
      return null;
    }
    
    console.log('Club ID found:', data?.id);
    return data?.id || null;
  } catch (error) {
    console.error('Error getting club ID:', error);
    return null;
  }
};

// Helper function to get the club details for a club admin
export const getClubAdminClubDetails = async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log('No authenticated user found');
      return null;
    }
    
    console.log('Getting club details for club admin:', user.id);
    
    // Get the club details from the clubs table
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name, logo_url, is_suspended')
      .eq('admin_id', user.id)
      .single();
      
    if (error) {
      console.error('Error getting club details:', error);
      return null;
    }
    
    console.log('Club details found:', data);
    return data || null;
  } catch (error) {
    console.error('Error getting club details:', error);
    return null;
  }
}; 