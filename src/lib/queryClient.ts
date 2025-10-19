import { QueryClient } from '@tanstack/react-query';
import { globalErrorHandler, shouldRetryError } from './queryUtils';

/**
 * Optimized React Query client configuration for better caching and performance
 * 
 * Features:
 * - 5 minute stale time for better caching
 * - 10 minute cache time to keep data in memory
 * - Exponential backoff retry strategy
 * - Enhanced error handling with user feedback
 * - Smart retry logic based on error type
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 2 minutes for better responsiveness
      staleTime: 2 * 60 * 1000, // 2 minutes
      
      // Keep data in cache for 15 minutes after component unmounts
      gcTime: 15 * 60 * 1000, // 15 minutes (formerly cacheTime)
      
      // Smart retry logic based on error type
      retry: (failureCount, error) => {
        // Don't retry on authentication or permission errors
        if (!shouldRetryError(error)) {
          return false;
        }
        
        // Retry up to 3 times for retryable errors
        return failureCount < 3;
      },
      
      // Exponential backoff with jitter
      retryDelay: (attemptIndex) => {
        const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.1 * baseDelay;
        return baseDelay + jitter;
      },
      
      // Enhanced background refetching for better data freshness
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: 'always', // Always refetch on mount for data consistency
      
      // Background refetching without loading indicators
      notifyOnChangeProps: ['data', 'error'], // Only notify on data/error changes, not loading states
      
      // Handle errors gracefully in components
      throwOnError: false,
    },
    mutations: {
      // Smart retry for mutations
      retry: (failureCount, error) => {
        if (!shouldRetryError(error)) {
          return false;
        }
        return failureCount < 2;
      },
      
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});