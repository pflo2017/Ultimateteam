import { supabase } from '../lib/supabase';

// Define the standard payment status values
export type PaymentStatus = 
  | 'select_status'  // Default for new players
  | 'on_trial'       // 30-day free trial
  | 'trial_ended'    // Automatically set after trial period
  | 'pending'        // Not paid for current month yet
  | 'unpaid'         // Automatically set when pending rolls over
  | 'paid';          // Payment confirmed

// Call Supabase RPC to run payment status transitions
export const checkAndUpdatePaymentStatuses = async () => {
  try {
    const { data, error } = await supabase
      .rpc('run_status_transitions');
    
    if (error) {
      console.error('Error running status transitions:', error);
      return false;
    }
    
    console.log('Status transitions completed successfully');
    return true;
  } catch (err) {
    console.error('Exception running status transitions:', err);
    return false;
  }
};

// Get human-readable text for payment status
export const getPaymentStatusText = (status: string): string => {
  switch (status) {
    case 'paid': return 'Paid';
    case 'pending': return 'Pending';
    case 'unpaid': return 'Unpaid';
    case 'on_trial': return 'On Trial';
    case 'trial_ended': return 'Trial Ended';
    case 'select_status': return 'Select Status';
    default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  }
};

// Get color for payment status
export const getPaymentStatusColor = (status: string): string => {
  switch (status) {
    case 'paid': return '#4CAF50'; // Green
    case 'pending': return '#FFA500'; // Orange
    case 'unpaid': return '#F44336'; // Red
    case 'on_trial': return '#2196F3'; // Blue
    case 'trial_ended': return '#607D8B'; // Grey
    case 'select_status': return '#9E9E9E'; // Light Grey
    default: return '#9E9E9E'; // Light Grey
  }
};

// Get payment history for a player
export const getPlayerPaymentHistory = async (playerId: string, year: number) => {
  try {
    const { data, error } = await supabase
      .from('player_status_history')
      .select('*')
      .eq('player_id', playerId)
      .order('changed_at', { ascending: false })
      .limit(20);
      
    if (error) {
      console.error('Error fetching player payment history:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Exception fetching payment history:', err);
    return [];
  }
}; 