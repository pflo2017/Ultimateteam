import { useState, useCallback } from 'react';
import { JWTErrorHandler } from '../utils/jwtErrorHandler';

/**
 * Custom hook for making Supabase queries with automatic JWT error handling
 * @param queryFn The function that performs the Supabase query
 * @returns Object with data, error, loading state, and refetch function
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await JWTErrorHandler.withJWTHandling(queryFn);
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [queryFn]);

  return {
    data,
    error,
    loading,
    refetch: executeQuery,
  };
}

/**
 * Custom hook for making Supabase mutations with automatic JWT error handling
 * @param mutationFn The function that performs the Supabase mutation
 * @returns Object with data, error, loading state, and execute function
 */
export function useSupabaseMutation<T>(
  mutationFn: () => Promise<{ data: T | null; error: any }>
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const executeMutation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await JWTErrorHandler.withJWTHandling(mutationFn);
      
      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
        setError(null);
      }
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [mutationFn]);

  return {
    data,
    error,
    loading,
    execute: executeMutation,
  };
} 