import { QueryClient } from '@tanstack/react-query';
import { errorHandler } from './errorHandling';

/**
 * Cleanup operation result
 */
interface CleanupResult {
  success: boolean;
  errors: string[];
  clearedItems: string[];
}

const CLEANUP_CONFIG = {
  // Keys to remove from localStorage
  LOCAL_STORAGE_KEYS: [
    'sb-wpqetuxkjsmzxzuvybes-auth-token',
    'supabase.auth.token',
    'auth-token',
    'user-preferences',
    'cached-profile',
    'flipbook-cache',
    'analytics-cache',
  ],
  
  // Keys to remove from sessionStorage
  SESSION_STORAGE_KEYS: [
    'temp-auth-data',
    'session-cache',
    'upload-progress',
    'form-data',
  ],
  
  // IndexedDB databases to clear
  INDEXED_DB_NAMES: [
    'supabase-cache',
    'app-cache',
    'offline-data',
  ],
  
  // Cache names to clear (Service Worker caches)
  CACHE_NAMES: [
    'auth-cache',
    'api-cache',
    'static-cache',
  ],
} as const;



/**
 * Memory cleanup utilities
 */
class MemoryCleanup {
  private sensitiveVariables: Set<string> = new Set();
  
  /**
   * Register a variable for cleanup
   */
  public registerSensitiveVariable(variableName: string): void {
    this.sensitiveVariables.add(variableName);
  }
  
  /**
   * Clear sensitive variables from memory
   */
  public clearSensitiveVariables(): void {
    this.sensitiveVariables.forEach(varName => {
      try {
        // Attempt to clear from global scope (if accessible)
        if (typeof window !== 'undefined' && (window as any)[varName]) {
          (window as any)[varName] = null;
          delete (window as any)[varName];
        }
      } catch (error) {
        console.warn(`Could not clear variable ${varName}:`, error);
      }
    });
    
    this.sensitiveVariables.clear();
  }
  
  /**
   * Force garbage collection (if available)
   */
  public forceGarbageCollection(): void {
    try {
      // Force garbage collection in development (Chrome DevTools)
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc();
      }
    } catch (error) {
      // Garbage collection not available, ignore
    }
  }
}

/**
 * Storage cleanup utilities
 */
class StorageCleanup {
  /**
   * Clear localStorage items
   */
  public clearLocalStorage(): CleanupResult {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    if (typeof window === 'undefined' || !window.localStorage) {
      result.errors.push('localStorage not available');
      result.success = false;
      return result;
    }
    
    // Clear specific keys
    CLEANUP_CONFIG.LOCAL_STORAGE_KEYS.forEach(key => {
      try {
        if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          result.clearedItems.push(`localStorage:${key}`);
        }
      } catch (error) {
        result.errors.push(`Failed to clear localStorage key ${key}: ${error}`);
        result.success = false;
      }
    });
    
    // Clear any remaining auth-related keys
    try {
      const allKeys = Object.keys(localStorage);
      const authKeys = allKeys.filter(key => 
        key.includes('auth') || 
        key.includes('token') || 
        key.includes('supabase') ||
        key.includes('session')
      );
      
      authKeys.forEach(key => {
        if (!CLEANUP_CONFIG.LOCAL_STORAGE_KEYS.includes(key as any)) {
          localStorage.removeItem(key);
          result.clearedItems.push(`localStorage:${key} (auto-detected)`);
        }
      });
    } catch (error) {
      result.errors.push(`Failed to clear auto-detected keys: ${error}`);
    }
    
    return result;
  }
  
  /**
   * Clear sessionStorage items
   */
  public clearSessionStorage(): CleanupResult {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    if (typeof window === 'undefined' || !window.sessionStorage) {
      result.errors.push('sessionStorage not available');
      result.success = false;
      return result;
    }
    
    CLEANUP_CONFIG.SESSION_STORAGE_KEYS.forEach(key => {
      try {
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.removeItem(key);
          result.clearedItems.push(`sessionStorage:${key}`);
        }
      } catch (error) {
        result.errors.push(`Failed to clear sessionStorage key ${key}: ${error}`);
        result.success = false;
      }
    });
    
    return result;
  }
  
  /**
   * Clear IndexedDB databases
   */
  public async clearIndexedDB(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    if (typeof window === 'undefined' || !window.indexedDB) {
      result.errors.push('IndexedDB not available');
      result.success = false;
      return result;
    }
    
    for (const dbName of CLEANUP_CONFIG.INDEXED_DB_NAMES) {
      try {
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        
        await new Promise<void>((resolve, reject) => {
          deleteRequest.onsuccess = () => {
            result.clearedItems.push(`indexedDB:${dbName}`);
            resolve();
          };
          
          deleteRequest.onerror = () => {
            reject(deleteRequest.error);
          };
          
          deleteRequest.onblocked = () => {
            // Database deletion is blocked, but we can continue
            result.errors.push(`IndexedDB ${dbName} deletion blocked`);
            resolve();
          };
        });
      } catch (error) {
        result.errors.push(`Failed to clear IndexedDB ${dbName}: ${error}`);
        result.success = false;
      }
    }
    
    return result;
  }
  
  /**
   * Clear Service Worker caches
   */
  public async clearCaches(): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    if (typeof window === 'undefined' || !('caches' in window)) {
      result.errors.push('Cache API not available');
      result.success = false;
      return result;
    }
    
    try {
      const cacheNames = await caches.keys();
      
      for (const cacheName of cacheNames) {
        // Clear specific caches or auth-related caches
        const shouldClear = CLEANUP_CONFIG.CACHE_NAMES.some(name => 
          cacheName.includes(name)
        ) || cacheName.includes('auth') || cacheName.includes('api');
        
        if (shouldClear) {
          try {
            await caches.delete(cacheName);
            result.clearedItems.push(`cache:${cacheName}`);
          } catch (error) {
            result.errors.push(`Failed to clear cache ${cacheName}: ${error}`);
            result.success = false;
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to access caches: ${error}`);
      result.success = false;
    }
    
    return result;
  }
}

/**
 * React Query cleanup utilities
 */
class QueryCacheCleanup {
  /**
   * Clear React Query cache with specific patterns
   */
  public clearQueryCache(queryClient: QueryClient): CleanupResult {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    try {
      // Clear all queries
      queryClient.clear();
      result.clearedItems.push('react-query:all-queries');
      
      // Remove specific query patterns
      const sensitiveQueryKeys = [
        'profile',
        'user',
        'auth',
        'flipbooks',
        'analytics',
        'uploads',
      ];
      
      sensitiveQueryKeys.forEach(key => {
        try {
          queryClient.removeQueries({ queryKey: [key] });
          result.clearedItems.push(`react-query:${key}`);
        } catch (error) {
          result.errors.push(`Failed to clear query ${key}: ${error}`);
        }
      });
      
      // Cancel any ongoing queries
      queryClient.cancelQueries();
      result.clearedItems.push('react-query:cancelled-queries');
      
    } catch (error) {
      result.errors.push(`Failed to clear React Query cache: ${error}`);
      result.success = false;
    }
    
    return result;
  }
}

/**
 * Main secure cleanup manager
 */
class SecureCleanupManager {
  private memoryCleanup = new MemoryCleanup();
  private storageCleanup = new StorageCleanup();
  private queryCacheCleanup = new QueryCacheCleanup();
  
  /**
   * Perform comprehensive cleanup on sign-out
   */
  public async performSignOutCleanup(queryClient: QueryClient): Promise<CleanupResult> {
    const overallResult: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    console.log('Starting secure sign-out cleanup...');
    
    // 1. Clear React Query cache
    try {
      const queryResult = this.queryCacheCleanup.clearQueryCache(queryClient);
      overallResult.clearedItems.push(...queryResult.clearedItems);
      overallResult.errors.push(...queryResult.errors);
      if (!queryResult.success) overallResult.success = false;
    } catch (error) {
      overallResult.errors.push(`Query cache cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    // 2. Clear localStorage
    try {
      const localStorageResult = this.storageCleanup.clearLocalStorage();
      overallResult.clearedItems.push(...localStorageResult.clearedItems);
      overallResult.errors.push(...localStorageResult.errors);
      if (!localStorageResult.success) overallResult.success = false;
    } catch (error) {
      overallResult.errors.push(`localStorage cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    // 3. Clear sessionStorage
    try {
      const sessionStorageResult = this.storageCleanup.clearSessionStorage();
      overallResult.clearedItems.push(...sessionStorageResult.clearedItems);
      overallResult.errors.push(...sessionStorageResult.errors);
      if (!sessionStorageResult.success) overallResult.success = false;
    } catch (error) {
      overallResult.errors.push(`sessionStorage cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    // 4. Clear IndexedDB (async)
    try {
      const indexedDBResult = await this.storageCleanup.clearIndexedDB();
      overallResult.clearedItems.push(...indexedDBResult.clearedItems);
      overallResult.errors.push(...indexedDBResult.errors);
      if (!indexedDBResult.success) overallResult.success = false;
    } catch (error) {
      overallResult.errors.push(`IndexedDB cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    // 5. Clear caches (async)
    try {
      const cacheResult = await this.storageCleanup.clearCaches();
      overallResult.clearedItems.push(...cacheResult.clearedItems);
      overallResult.errors.push(...cacheResult.errors);
      if (!cacheResult.success) overallResult.success = false;
    } catch (error) {
      overallResult.errors.push(`Cache cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    // 6. Clear sensitive variables from memory
    try {
      this.memoryCleanup.clearSensitiveVariables();
      this.memoryCleanup.forceGarbageCollection();
      overallResult.clearedItems.push('memory:sensitive-variables');
    } catch (error) {
      overallResult.errors.push(`Memory cleanup failed: ${error}`);
      overallResult.success = false;
    }
    
    console.log('Secure cleanup completed:', {
      success: overallResult.success,
      clearedItems: overallResult.clearedItems.length,
      errors: overallResult.errors.length,
    });
    
    return overallResult;
  }
  
  /**
   * Register sensitive variable for cleanup
   */
  public registerSensitiveVariable(variableName: string): void {
    this.memoryCleanup.registerSensitiveVariable(variableName);
  }
  
  /**
   * Perform quick cleanup (for emergency sign-out)
   */
  public performQuickCleanup(queryClient: QueryClient): CleanupResult {
    const result: CleanupResult = {
      success: true,
      errors: [],
      clearedItems: [],
    };
    
    try {
      // Clear React Query cache
      queryClient.clear();
      result.clearedItems.push('react-query:all-queries');
      
      // Clear critical localStorage items
      const criticalKeys = [
        'sb-wpqetuxkjsmzxzuvybes-auth-token',
        'supabase.auth.token',
      ];
      
      criticalKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
          result.clearedItems.push(`localStorage:${key}`);
        } catch (error) {
          result.errors.push(`Failed to clear ${key}: ${error}`);
        }
      });
      
      // Clear memory
      this.memoryCleanup.clearSensitiveVariables();
      result.clearedItems.push('memory:sensitive-variables');
      
    } catch (error) {
      result.errors.push(`Quick cleanup failed: ${error}`);
      result.success = false;
    }
    
    return result;
  }
}

// Export singleton instance
export const secureCleanupManager = new SecureCleanupManager();

// Export types and utilities
export type { CleanupResult };
export { CLEANUP_CONFIG };