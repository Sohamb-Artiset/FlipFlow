import { UseQueryOptions, UseMutationOptions, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Common query options for different types of data
 */
export const queryOptions = {
  /**
   * Options for user profile data - cached longer since it changes infrequently
   */
  profile: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  /**
   * Options for flipbook list data - moderate caching
   */
  flipbooks: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  /**
   * Options for real-time data - shorter cache times
   */
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 10000),
  },
} as const;

/**
 * Enhanced error handler for queries with user-friendly messages
 */
export const handleQueryError = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'Authentication failed. Please sign in again.';
    }
    
    // Database/Supabase errors
    if (message.includes('supabase') || message.includes('database') || message.includes('sql')) {
      return 'Database error occurred. Please try again in a moment.';
    }
    
    // Timeout errors
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'Request timed out. Please check your connection and try again.';
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('access denied')) {
      return 'You don\'t have permission to perform this action.';
    }
    
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  // Handle Supabase errors
  if (error && typeof error === 'object' && 'message' in error) {
    return (error as { message: string }).message;
  }
  
  return 'An unexpected error occurred. Please try again.';
};

/**
 * Enhanced mutation options with better error handling and user feedback
 */
export const defaultMutationOptions: Partial<UseMutationOptions> = {
  retry: (failureCount, error) => {
    // Don't retry on authentication errors
    if (error instanceof Error && error.message.toLowerCase().includes('auth')) {
      return false;
    }
    
    // Don't retry on permission errors
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return false;
    }
    
    // Retry up to 2 times for other errors
    return failureCount < 2;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  onError: (error, variables, context) => {
    const errorMessage = handleQueryError(error);
    
    // Enhanced error feedback with retry options
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('network') || message.includes('fetch')) {
        toast.error('Connection Error', {
          description: 'Unable to complete operation. Please check your connection.',
          action: {
            label: 'Retry',
            onClick: () => {
              // The retry will be handled by the calling component
              console.log('Retry requested for mutation');
            },
          },
        });
      } else if (message.includes('permission') || message.includes('forbidden')) {
        toast.error('Permission Denied', {
          description: errorMessage,
          action: {
            label: 'Contact Support',
            onClick: () => window.open('mailto:support@flipflow.com', '_blank'),
          },
        });
      } else {
        toast.error('Operation Failed', {
          description: errorMessage,
          action: {
            label: 'Try Again',
            onClick: () => {
              console.log('Retry requested for mutation');
            },
          },
        });
      }
    } else {
      toast.error('Operation Failed', {
        description: errorMessage,
      });
    }
  },
};

/**
 * Enhanced query options with consistent error handling and retry logic
 */
export const createQueryOptions = <T>(
  options: Partial<UseQueryOptions<T>> = {}
): Partial<UseQueryOptions<T>> => ({
  retry: (failureCount, error) => {
    // Don't retry on authentication errors
    if (error instanceof Error && error.message.toLowerCase().includes('auth')) {
      return false;
    }
    
    // Don't retry on permission errors  
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return false;
    }
    
    // Retry up to 3 times for other errors
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  throwOnError: false, // Handle errors gracefully in components
  ...options,
});

/**
 * Global error handler for React Query with enhanced user feedback
 */
export const globalErrorHandler = (error: unknown, query: any) => {
  console.error('Query error:', error, query);
  
  // Don't show toast for background refetches or when data is already available
  if (query.state.fetchStatus === 'fetching' && query.state.data !== undefined) {
    return;
  }
  
  // Don't show toast for authentication errors (handled by auth context)
  if (error instanceof Error && error.message.toLowerCase().includes('auth')) {
    return;
  }
  
  const errorMessage = handleQueryError(error);
  
  // Enhanced error feedback based on error type
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      toast.error('Connection Problem', {
        description: 'Unable to load data. Please check your internet connection.',
        action: {
          label: 'Retry',
          onClick: () => {
            query.refetch?.();
          },
        },
      });
    } else if (message.includes('timeout')) {
      toast.error('Request Timeout', {
        description: 'The request took too long. Please try again.',
        action: {
          label: 'Retry',
          onClick: () => {
            query.refetch?.();
          },
        },
      });
    } else {
      toast.error('Data Loading Failed', {
        description: errorMessage,
        action: {
          label: 'Retry',
          onClick: () => {
            query.refetch?.();
          },
        },
      });
    }
  } else {
    toast.error('Data Loading Failed', {
      description: errorMessage,
    });
  }
};

/**
 * Utility to determine if an error should trigger a retry
 */
export const shouldRetryError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Don't retry authentication or permission errors
    if (message.includes('auth') || message.includes('permission') || message.includes('forbidden')) {
      return false;
    }
    
    // Don't retry client-side validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return false;
    }
  }
  
  return true;
};

/**
 * Enhanced retry configuration for different error types
 */
export const getRetryConfig = (error: unknown) => {
  if (!shouldRetryError(error)) {
    return { retry: false, retryDelay: 0 };
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Faster retry for network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 10000),
      };
    }
    
    // Slower retry for server errors
    if (message.includes('server') || message.includes('database')) {
      return {
        retry: 2,
        retryDelay: (attemptIndex: number) => Math.min(2000 * 2 ** attemptIndex, 30000),
      };
    }
  }
  
  // Default retry configuration
  return {
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  };
};