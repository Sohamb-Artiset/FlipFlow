/**
 * Permission Error Handler
 * 
 * Provides secure error message handling to prevent information leakage
 * while maintaining good user experience for permission-related errors.
 */

import { PermissionResult, permissionValidator } from './permissionValidator';
import { errorHandler } from './errorHandling';

// Sanitized error response
interface SanitizedErrorResponse {
  userMessage: string;
  shouldRetry: boolean;
  suggestedAction?: string;
  requiresAuth?: boolean;
}

/**
 * Permission Error Handler Class
 */
export class PermissionErrorHandler {
  private static instance: PermissionErrorHandler;
  
  private constructor() {}
  
  public static getInstance(): PermissionErrorHandler {
    if (!PermissionErrorHandler.instance) {
      PermissionErrorHandler.instance = new PermissionErrorHandler();
    }
    return PermissionErrorHandler.instance;
  }

  /**
   * Handle permission-related errors with secure messaging
   */
  public handlePermissionError(
    error: unknown,
    context: { operation: string; resource?: string; userId?: string }
  ): SanitizedErrorResponse {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    // Handle authentication errors
    if (this.isAuthError(message)) {
      return {
        userMessage: 'Please sign in to continue.',
        shouldRetry: false,
        requiresAuth: true,
        suggestedAction: 'Sign in to your account'
      };
    }

    // Handle permission errors
    if (this.isPermissionError(message)) {
      return {
        userMessage: 'You don\'t have permission to perform this action.',
        shouldRetry: false,
        suggestedAction: 'Contact the resource owner or administrator'
      };
    }

    // Handle RLS policy violations
    if (this.isRLSError(message)) {
      return {
        userMessage: 'Access denied. You can only access your own data.',
        shouldRetry: false,
        suggestedAction: 'Ensure you are signed in with the correct account'
      };
    }

    // Default secure response
    return {
      userMessage: 'An error occurred while processing your request.',
      shouldRetry: true,
      suggestedAction: 'Please try again or contact support if the problem persists'
    };
  }

  private isAuthError(message: string): boolean {
    const authKeywords = ['unauthorized', 'unauthenticated', 'invalid_token', 'session_expired'];
    return authKeywords.some(keyword => message.includes(keyword));
  }

  private isPermissionError(message: string): boolean {
    const permissionKeywords = ['forbidden', 'access_denied', 'insufficient_privileges', 'permission_denied'];
    return permissionKeywords.some(keyword => message.includes(keyword));
  }

  private isRLSError(message: string): boolean {
    const rlsKeywords = ['row level security', 'rls', 'policy', 'violates row-level security'];
    return rlsKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Create user-friendly permission error message
   */
  public createPermissionErrorMessage(result: PermissionResult): string {
    if (result.allowed) return '';
    return permissionValidator.getPermissionErrorMessage(result);
  }
}

// Export singleton instance
export const permissionErrorHandler = PermissionErrorHandler.getInstance();