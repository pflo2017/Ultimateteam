import { supabase, refreshToken } from '../lib/supabase';

/**
 * Global JWT error handler for React Native app
 * Automatically handles JWT expired errors by refreshing the token
 */
export class JWTErrorHandler {
  private static isRefreshing = false;
  private static refreshPromise: Promise<boolean> | null = null;

  /**
   * Handle JWT expired errors by attempting to refresh the token
   * @param error The error object from Supabase
   * @returns Promise<boolean> - true if token was refreshed successfully, false otherwise
   */
  static async handleJWTError(error: any): Promise<boolean> {
    // Check if this is a JWT expired error
    if (this.isJWTExpiredError(error)) {
      console.log('JWT expired error detected, attempting token refresh...');
      
      // If already refreshing, wait for the existing refresh to complete
      if (this.isRefreshing && this.refreshPromise) {
        console.log('Token refresh already in progress, waiting...');
        return await this.refreshPromise;
      }
      
      // Start a new refresh
      this.isRefreshing = true;
      this.refreshPromise = this.performTokenRefresh();
      
      try {
        const result = await this.refreshPromise;
        return result;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    }
    
    return false;
  }

  /**
   * Check if an error is a JWT expired error
   */
  private static isJWTExpiredError(error: any): boolean {
    if (!error) return false;
    
    // Check for various JWT expired error patterns
    const errorMessage = error.message || error.error?.message || '';
    const errorCode = error.code || error.error?.code || '';
    
    return (
      errorMessage.includes('JWT expired') ||
      errorMessage.includes('JWT') ||
      errorCode === 'PGRST301' ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('unauthorized')
    );
  }

  /**
   * Perform the actual token refresh
   */
  private static async performTokenRefresh(): Promise<boolean> {
    try {
      console.log('Starting manual token refresh...');
      const success = await refreshToken();
      
      if (success) {
        console.log('Token refresh successful');
        return true;
      } else {
        console.log('Token refresh failed');
        // If refresh fails, the user needs to log in again
        await this.handleRefreshFailure();
        return false;
      }
    } catch (error) {
      console.error('Error during token refresh:', error);
      await this.handleRefreshFailure();
      return false;
    }
  }

  /**
   * Handle token refresh failure by signing out the user
   */
  private static async handleRefreshFailure(): Promise<void> {
    console.log('Token refresh failed, signing out user...');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out after refresh failure:', error);
    }
  }

  /**
   * Wrap a Supabase query with JWT error handling
   * @param queryFn The function that performs the Supabase query
   * @returns Promise with the query result
   */
  static async withJWTHandling<T>(queryFn: () => Promise<{ data: T | null; error: any }>): Promise<{ data: T | null; error: any }> {
    try {
      const result = await queryFn();
      
      // If there's an error, check if it's a JWT error
      if (result.error) {
        const wasRefreshed = await this.handleJWTError(result.error);
        
        if (wasRefreshed) {
          // Retry the original query with the new token
          console.log('Retrying query after token refresh...');
          return await queryFn();
        }
      }
      
      return result;
    } catch (error) {
      // Handle any other errors
      const wasRefreshed = await this.handleJWTError(error);
      
      if (wasRefreshed) {
        // Retry the original query with the new token
        console.log('Retrying query after token refresh...');
        return await queryFn();
      }
      
      throw error;
    }
  }
}

/**
 * Hook to use JWT error handling in components
 */
export const useJWTErrorHandler = () => {
  return {
    handleJWTError: JWTErrorHandler.handleJWTError,
    withJWTHandling: JWTErrorHandler.withJWTHandling,
  };
}; 