import { supabase } from '../lib/supabase';

// Define payment status types for better type safety
export type PaymentStatus = 
  | 'select_status'  // Default status for new players
  | 'on_trial'       // 30-day free trial
  | 'trial_ended'    // After trial expires
  | 'pending'        // Not paid for current month yet
  | 'unpaid'         // Status when pending rolls over
  | 'paid';          // Payment confirmed

// Function to check and update payment statuses
export const checkAndUpdatePaymentStatuses = async (): Promise<void> => {
  try {
    // Call the database function to run the status transitions
    const { error } = await supabase.rpc('run_status_transitions');
    
    if (error) {
      console.error('Error running payment status transitions:', error);
    } else {
      console.log('Payment status transitions completed successfully');
    }
  } catch (error) {
    console.error('Unexpected error in checkAndUpdatePaymentStatuses:', error);
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

// Function to get payment history for a player
export const getPlayerPaymentHistory = async (playerId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('player_status_history')
      .select('*')
      .eq('player_id', playerId)
      .order('changed_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching player payment history:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Unexpected error in getPlayerPaymentHistory:', error);
    return [];
  }
}; 