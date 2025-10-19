/**
 * Secure redirect handling for post-sign-out navigation
 * Ensures safe redirection without exposing sensitive information
 */

/**
 * Redirect configuration
 */
const REDIRECT_CONFIG = {
  // Default redirect after sign-out
  DEFAULT_SIGN_OUT_REDIRECT: '/auth',
  
  // Safe redirect paths (whitelist)
  SAFE_PATHS: [
    '/',
    '/auth',
    '/auth/signin',
    '/auth/signup',
    '/auth/forgot-password',
    '/about',
    '/contact',
    '/privacy',
    '/terms',
  ],
  
  // Paths that require authentication (blacklist)
  PROTECTED_PATHS: [
    '/dashboard',
    '/profile',
    '/settings',
    '/flipbooks',
    '/analytics',
    '/admin',
  ],
  
  // Maximum redirect delay (ms)
  MAX_REDIRECT_DELAY: 3000,
} as const;

/**
 * Redirect options interface
 */
interface RedirectOptions {
  delay?: number;
  replace?: boolean;
  clearHistory?: boolean;
  preserveQuery?: boolean;
  onBeforeRedirect?: () => void;
  onAfterRedirect?: () => void;
}

/**
 * Redirect result interface
 */
interface RedirectResult {
  success: boolean;
  redirectedTo: string;
  error?: string;
}

/**
 * Secure redirect manager
 */
class SecureRedirectManager {
  /**
   * Validate if a path is safe for redirection
   */
  private isPathSafe(path: string): boolean {
    try {
      // Parse the path to handle query parameters and fragments
      const url = new URL(path, window.location.origin);
      const pathname = url.pathname;
      
      // Check if path is in safe list
      if (REDIRECT_CONFIG.SAFE_PATHS.includes(pathname)) {
        return true;
      }
      
      // Check if path is protected (should not redirect to)
      if (REDIRECT_CONFIG.PROTECTED_PATHS.some(protectedPath => 
        pathname.startsWith(protectedPath)
      )) {
        return false;
      }
      
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /ftp:/i,
      ];
      
      if (dangerousPatterns.some(pattern => pattern.test(path))) {
        return false;
      }
      
      // Allow relative paths that don't start with protected paths
      if (pathname.startsWith('/') && !pathname.includes('..')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error validating redirect path:', error);
      return false;
    }
  }
  
  /**
   * Sanitize redirect path
   */
  private sanitizePath(path: string): string {
    try {
      // Remove any potentially dangerous characters
      let sanitized = path.replace(/[<>'"]/g, '');
      
      // Ensure it starts with /
      if (!sanitized.startsWith('/')) {
        sanitized = '/' + sanitized;
      }
      
      // Remove double slashes
      sanitized = sanitized.replace(/\/+/g, '/');
      
      // Remove trailing slash (except for root)
      if (sanitized.length > 1 && sanitized.endsWith('/')) {
        sanitized = sanitized.slice(0, -1);
      }
      
      return sanitized;
    } catch (error) {
      console.error('Error sanitizing path:', error);
      return REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT;
    }
  }
  
  /**
   * Perform secure redirect after sign-out
   */
  public async performSignOutRedirect(
    targetPath?: string,
    options: RedirectOptions = {}
  ): Promise<RedirectResult> {
    const {
      delay = 0,
      replace = true,
      clearHistory = false,
      preserveQuery = false,
      onBeforeRedirect,
      onAfterRedirect,
    } = options;
    
    try {
      // Determine the target path
      let redirectPath = targetPath || REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT;
      
      // Sanitize the path
      redirectPath = this.sanitizePath(redirectPath);
      
      // Validate the path is safe
      if (!this.isPathSafe(redirectPath)) {
        console.warn(`Unsafe redirect path detected: ${redirectPath}, using default`);
        redirectPath = REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT;
      }
      
      // Preserve query parameters if requested
      if (preserveQuery && window.location.search) {
        const currentQuery = window.location.search;
        // Only preserve safe query parameters
        const safeQuery = this.sanitizeQueryString(currentQuery);
        if (safeQuery) {
          redirectPath += safeQuery;
        }
      }
      
      // Execute before redirect callback
      if (onBeforeRedirect) {
        try {
          onBeforeRedirect();
        } catch (error) {
          console.error('Error in onBeforeRedirect callback:', error);
        }
      }
      
      // Clear browser history if requested
      if (clearHistory) {
        try {
          // Clear forward/back history by replacing all entries
          window.history.replaceState(null, '', redirectPath);
        } catch (error) {
          console.warn('Could not clear history:', error);
        }
      }
      
      // Perform the redirect with delay if specified
      const performRedirect = () => {
        try {
          if (replace) {
            window.location.replace(redirectPath);
          } else {
            window.location.href = redirectPath;
          }
          
          // Execute after redirect callback
          if (onAfterRedirect) {
            try {
              onAfterRedirect();
            } catch (error) {
              console.error('Error in onAfterRedirect callback:', error);
            }
          }
        } catch (error) {
          console.error('Redirect failed:', error);
          throw error;
        }
      };
      
      if (delay > 0) {
        // Ensure delay doesn't exceed maximum
        const safeDelay = Math.min(delay, REDIRECT_CONFIG.MAX_REDIRECT_DELAY);
        setTimeout(performRedirect, safeDelay);
      } else {
        performRedirect();
      }
      
      return {
        success: true,
        redirectedTo: redirectPath,
      };
    } catch (error) {
      console.error('Secure redirect failed:', error);
      
      // Fallback to default redirect
      try {
        window.location.replace(REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT);
        return {
          success: false,
          redirectedTo: REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT,
          error: `Redirect failed, used fallback: ${error}`,
        };
      } catch (fallbackError) {
        return {
          success: false,
          redirectedTo: '',
          error: `Both redirect and fallback failed: ${error}`,
        };
      }
    }
  }
  
  /**
   * Sanitize query string parameters
   */
  private sanitizeQueryString(queryString: string): string {
    try {
      const params = new URLSearchParams(queryString);
      const sanitizedParams = new URLSearchParams();
      
      // Whitelist of safe query parameters
      const safeParams = ['redirect', 'tab', 'page', 'sort', 'filter'];
      
      params.forEach((value, key) => {
        // Only include safe parameters
        if (safeParams.includes(key.toLowerCase())) {
          // Sanitize the value
          const sanitizedValue = value.replace(/[<>'"]/g, '').slice(0, 100);
          if (sanitizedValue) {
            sanitizedParams.set(key, sanitizedValue);
          }
        }
      });
      
      const result = sanitizedParams.toString();
      return result ? `?${result}` : '';
    } catch (error) {
      console.error('Error sanitizing query string:', error);
      return '';
    }
  }
  
  /**
   * Check if current path requires authentication
   */
  public isCurrentPathProtected(): boolean {
    try {
      const currentPath = window.location.pathname;
      return REDIRECT_CONFIG.PROTECTED_PATHS.some(protectedPath =>
        currentPath.startsWith(protectedPath)
      );
    } catch (error) {
      console.error('Error checking protected path:', error);
      return false;
    }
  }
  
  /**
   * Get safe redirect path from current location
   */
  public getSafeRedirectPath(): string {
    try {
      const currentPath = window.location.pathname;
      
      if (this.isPathSafe(currentPath)) {
        return currentPath;
      }
      
      return REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT;
    } catch (error) {
      console.error('Error getting safe redirect path:', error);
      return REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT;
    }
  }
  
  /**
   * Perform emergency redirect (for security breaches)
   */
  public performEmergencyRedirect(): void {
    try {
      // Clear any sensitive data from URL
      window.history.replaceState(null, '', REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT);
      
      // Immediate redirect
      window.location.replace(REDIRECT_CONFIG.DEFAULT_SIGN_OUT_REDIRECT);
    } catch (error) {
      console.error('Emergency redirect failed:', error);
      // Last resort: reload the page
      window.location.reload();
    }
  }
}

// Export singleton instance
export const secureRedirectManager = new SecureRedirectManager();

// Export types and configuration
export type { RedirectOptions, RedirectResult };
export { REDIRECT_CONFIG };