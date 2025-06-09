import { supabase } from '../lib/supabase';
import { triggerEvent } from '../utils/events';

// Define consistent payment status types
// We use 'paid' and 'unpaid' in the UI
// But in the database we use 'paid' and 'not_paid'
export type PaymentStatus = 
  | 'paid'
  | 'unpaid';

// Define database status types for reference
export type DatabasePaymentStatus =
  | 'paid'
  | 'not_paid';

export interface PlayerPaymentStatus {
  player_id: string;
  status: PaymentStatus;
  statusSince: string;
}

/**
 * Get the current payment status for a player
 */
export const getPlayerPaymentStatus = async (playerId: string): Promise<PlayerPaymentStatus | null> => {
  try {
    console.log(`[PaymentStatusService] Getting payment status for player ${playerId}`);
    
    // First check the monthly_payments table for the current month - this is the source of truth
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12 format
    
    console.log(`[PaymentStatusService] Checking monthly_payments for ${currentYear}-${currentMonth}`);
    
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('monthly_payments')
      .select('status, updated_at')
      .eq('player_id', playerId)
      .eq('year', currentYear)
      .eq('month', currentMonth)
      .maybeSingle();
    
    if (!monthlyError && monthlyData) {
      console.log(`[PaymentStatusService] Found monthly status in DB:`, monthlyData);
      return {
        player_id: playerId,
        status: convertDbStatusToUi(monthlyData.status),
        statusSince: monthlyData.updated_at
      };
    }
    
    // If no record for current month, check previous month
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    console.log(`[PaymentStatusService] Checking monthly_payments for previous month ${previousYear}-${previousMonth}`);
    
    const { data: prevMonthData, error: prevMonthError } = await supabase
      .from('monthly_payments')
      .select('status, updated_at')
      .eq('player_id', playerId)
      .eq('year', previousYear)
      .eq('month', previousMonth)
      .maybeSingle();
    
    if (!prevMonthError && prevMonthData) {
      console.log(`[PaymentStatusService] Found previous month status in DB:`, prevMonthData);
      return {
        player_id: playerId,
        status: convertDbStatusToUi(prevMonthData.status),
        statusSince: prevMonthData.updated_at
      };
    }
    
    // Next, check the RPC function (if it exists)
    try {
      const { data: statusData, error: statusError } = await supabase
        .rpc('get_player_payment_status', { p_player_id: playerId });
      
      if (!statusError && statusData && statusData.length > 0) {
        console.log(`[PaymentStatusService] Found status from RPC:`, statusData[0]);
        return {
          player_id: playerId,
          status: convertDbStatusToUi(statusData[0].status),
          statusSince: statusData[0].status_since
        };
      }
    } catch (rpcError) {
      console.log(`[PaymentStatusService] RPC function not available or error:`, rpcError);
      // Continue to fallback
    }
    
    // Fallback to legacy player data
    console.log(`[PaymentStatusService] Falling back to player table for ${playerId}`);
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('payment_status, player_status, last_payment_date')
      .eq('id', playerId)
      .single();
      
    if (playerError) {
      console.error(`[PaymentStatusService] Error fetching from players table:`, playerError);
      throw playerError;
    }
    
    if (playerData) {
      let status: PaymentStatus = 'unpaid'; // Default
      
      // Determine status from available data
      if (playerData.payment_status === 'paid' || playerData.player_status === 'paid') {
        status = 'paid';
      }
      
      console.log(`[PaymentStatusService] Using status from players table:`, {
        original_payment_status: playerData.payment_status,
        original_player_status: playerData.player_status,
        resolved_status: status
      });
      
      // Store this status in monthly_payments for consistency
      const now = new Date().toISOString();
      
      // Create a monthly_payments record to maintain consistency
      try {
        const dbStatus = convertUiStatusToDb(status);
        await supabase
          .from('monthly_payments')
          .upsert({
            player_id: playerId,
            year: currentYear,
            month: currentMonth,
            status: dbStatus,
            updated_at: now
          }, {
            onConflict: 'player_id,year,month'
          });
        console.log(`[PaymentStatusService] Created consistent monthly payment record for ${currentYear}-${currentMonth}`);
      } catch (upsertError) {
        console.error('[PaymentStatusService] Error syncing status to monthly_payments:', upsertError);
      }
      
      return {
        player_id: playerId,
        status,
        statusSince: playerData.last_payment_date || now
      };
    }
    
    console.warn(`[PaymentStatusService] No payment status found for player ${playerId}`);
    return null;
  } catch (error) {
    console.error('[PaymentStatusService] Error getting player payment status:', error);
    throw error;
  }
};

/**
 * Convert database status to UI status
 */
const convertDbStatusToUi = (dbStatus: string): PaymentStatus => {
  if (dbStatus === 'paid') return 'paid';
  return 'unpaid'; // All non-paid statuses are shown as unpaid in the UI
};

/**
 * Convert UI status to database status
 */
const convertUiStatusToDb = (uiStatus: string): DatabasePaymentStatus => {
  if (uiStatus === 'paid') return 'paid';
  return 'not_paid'; // 'unpaid' in UI becomes 'not_paid' in DB
};

/**
 * Get the current month's payment status for a player
 * This specifically checks the monthly_payments table for the current month
 */
export const getCurrentMonthPaymentStatus = async (playerId: string): Promise<PaymentStatus> => {
  try {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1; // 1-12 format
    
    console.log(`[PaymentStatusService] Getting payment status for player ${playerId} for ${year}-${month}`);
    
    const { data, error } = await supabase
      .from('monthly_payments')
      .select('status')
      .eq('player_id', playerId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle();
    
    if (error) {
      console.error('[PaymentStatusService] Error fetching monthly payment status:', error);
      return 'unpaid'; // Default to unpaid on error
    }
    
    if (data) {
      const dbStatus = data.status;
      console.log(`[PaymentStatusService] Found monthly status in DB: ${dbStatus}`);
      
      // Convert database status to UI status
      const uiStatus = convertDbStatusToUi(dbStatus);
      console.log(`[PaymentStatusService] Converted to UI status: ${uiStatus}`);
      return uiStatus;
    }
    
    console.log(`[PaymentStatusService] No monthly payment record found for ${year}-${month}`);
    return 'unpaid'; // Default to unpaid if no record exists
  } catch (error) {
    console.error('[PaymentStatusService] Error fetching monthly payment status:', error);
    return 'unpaid'; // Default to unpaid on error
  }
};

/**
 * Update a player's payment status
 */
export const updatePlayerPaymentStatus = async (
  playerId: string, 
  status: PaymentStatus,
  updatedBy: string = 'app_user'
): Promise<void> => {
  try {
    console.log(`[PaymentStatusService] Updating payment status for ${playerId} to ${status}`);
    
    // Convert UI status to database status
    const dbStatus = convertUiStatusToDb(status);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12 format
    const timestamp = now.toISOString();
    
    // Create or update monthly_payments record for current month
    const { error: monthlyError } = await supabase
      .from('monthly_payments')
      .upsert({
        player_id: playerId,
        year: currentYear,
        month: currentMonth,
        status: dbStatus,
        updated_at: timestamp,
        updated_by: updatedBy
      }, {
        onConflict: 'player_id,year,month'
      });
      
    if (monthlyError) {
      console.error('[PaymentStatusService] Error updating monthly payment:', monthlyError);
      throw monthlyError;
    }
    
    // Also update players table for backward compatibility
    const { error: playerError } = await supabase
      .from('players')
      .update({
        payment_status: dbStatus,
        last_payment_date: status === 'paid' ? timestamp : null
      })
      .eq('id', playerId);
      
    if (playerError) {
      console.error('[PaymentStatusService] Error updating player record:', playerError);
      // Don't throw here, continue as monthly_payments is the source of truth
    }
    
    // Try to use the RPC function if it exists
    try {
      const { error: rpcError } = await supabase
        .rpc('update_player_payment_status', { 
          p_player_id: playerId,
          p_status: dbStatus,
          p_changed_by: updatedBy
        });
        
      if (rpcError) {
        console.error('[PaymentStatusService] Error calling RPC:', rpcError);
        // Continue since we've already updated the tables directly
      }
    } catch (rpcError) {
      console.log('[PaymentStatusService] RPC function not available:', rpcError);
      // Continue with direct table updates
    }
    
    console.log(`[PaymentStatusService] Successfully updated payment status to ${status} (DB: ${dbStatus})`);
    
    // Trigger event for real-time updates
    triggerEvent('payment_status_changed', playerId, status, 
      status === 'paid' ? timestamp : null);
  } catch (error) {
    console.error('[PaymentStatusService] Error updating player payment status:', error);
    throw error;
  }
};

/**
 * Get payment history for a player
 */
export const getPlayerPaymentHistory = async (playerId: string): Promise<any[]> => {
  try {
    console.log(`[PaymentStatusService] Getting payment history for player ${playerId}`);
    
    // Get data directly from monthly_payments (source of truth)
    const currentYear = new Date().getFullYear();
    const { data: monthlyData, error: monthlyError } = await supabase
      .from('monthly_payments')
      .select('year, month, status, updated_at')
      .eq('player_id', playerId)
      .gte('year', currentYear - 1) // Last year and this year
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    
    if (monthlyError) {
      console.error('[PaymentStatusService] Error fetching monthly payments:', monthlyError);
      return [];
    }
    
    if (monthlyData && monthlyData.length > 0) {
      console.log(`[PaymentStatusService] Found ${monthlyData.length} monthly payment records`);
      
      // Convert all database status values to UI status values
      const convertedData = monthlyData.map(record => ({
        ...record,
        status: convertDbStatusToUi(record.status)
      }));
      
      return convertedData;
    }
    
    console.log(`[PaymentStatusService] No payment history found for player ${playerId}`);
    return [];
  } catch (error) {
    console.error('[PaymentStatusService] Error getting payment history:', error);
    return [];
  }
};

/**
 * Get formatted text for payment status
 */
export const getPaymentStatusText = (status: string): string => {
  if (!status) return 'Not Paid';
  
  switch (status.toLowerCase()) {
    case 'paid': return 'Paid';
    case 'unpaid': return 'Not Paid';  // Changed from 'Unpaid' to 'Not Paid'
    case 'not_paid': return 'Not Paid'; // Consistent terminology
    default: return 'Not Paid'; // Default to Not Paid
  }
};

/**
 * Get color for payment status
 */
export const getPaymentStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'paid': return '#4CAF50'; // Green
    case 'unpaid': 
    case 'not_paid': return '#F44336'; // Red
    default: return '#F44336'; // Default to Red/Unpaid
  }
}; 