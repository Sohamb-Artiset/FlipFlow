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
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Keep data in cache for 10 minutes after component unmounts
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      
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
      
      // Enable background refetching when window regains focus
      refetchOnWindowFocus: true,
      
      // Refetch on reconnect after network issues
      refetchOnReconnect: true,
      
      // Don't refetch on mount if data is still fresh
      refetchOnMount: true,
      
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

// Set up global error handler
queryClient.setQueryDefaults(['*'], {
  onError: globalErrorHandler,
});