/**
 * Optimized query key factory for precise cache invalidation and background refetching
 * 
 * This provides a hierarchical approach to query keys that enables:
 * - Precise cache invalidation with minimal over-invalidation
 * - Easy debugging of cached data
 * - Consistent naming across the application
 * - Background refetching for stale data
 */

export const queryKeys = {
  // User-related queries with versioning for cache busting
  users: {
    all: ['users'] as const,
    profile: (userId: string) => ['users', 'profile', userId] as const,
    profileWithPlan: (userId: string) => ['users', 'profile', userId, 'plan'] as const,
  },
  
  // Flipbook-related queries with hierarchical structure
  flipbooks: {
    all: ['flipbooks'] as const,
    lists: () => ['flipbooks', 'list'] as const,
    list: (filters: Record<string, any>) => ['flipbooks', 'list', filters] as const,
    byUser: (userId: string) => ['flipbooks', 'list', { userId }] as const,
    details: () => ['flipbooks', 'detail'] as const,
    detail: (flipbookId: string) => ['flipbooks', 'detail', flipbookId] as const,
    public: () => ['flipbooks', 'list', { public: true }] as const,
    analytics: (flipbookId: string) => ['flipbooks', 'analytics', flipbookId] as const,
  },
  
  // Authentication-related queries
  auth: {
    all: ['auth'] as const,
    session: ['auth', 'session'] as const,
    profile: ['auth', 'profile'] as const,
  },
} as const;

/**
 * Precise cache invalidation helpers to minimize over-invalidation
 */

/**
 * Get keys for invalidating flipbook list queries for a specific user
 * Uses precise invalidation to avoid clearing unrelated cached data
 */
export const getFlipbookListInvalidationKeys = (userId: string) => [
  queryKeys.flipbooks.byUser(userId),
  queryKeys.flipbooks.lists(), // Invalidate all list queries
];

/**
 * Get keys for invalidating a specific flipbook detail
 * Only invalidates the specific flipbook, not all flipbooks
 */
export const getFlipbookDetailInvalidationKeys = (flipbookId: string, userId?: string) => {
  const keys = [queryKeys.flipbooks.detail(flipbookId)];
  
  // Also invalidate the user's flipbook list if userId is provided
  if (userId) {
    keys.push(...getFlipbookListInvalidationKeys(userId));
  }
  
  return keys;
};

/**
 * Get keys for invalidating all flipbook-related queries
 * Use sparingly - only when necessary for major data changes
 */
export const getAllFlipbookInvalidationKeys = () => [
  queryKeys.flipbooks.all,
];

/**
 * Get keys for invalidating user profile queries with precise targeting
 */
export const getUserProfileInvalidationKeys = (userId: string) => [
  queryKeys.users.profile(userId),
  queryKeys.users.profileWithPlan(userId),
  queryKeys.auth.profile,
];

/**
 * Get keys for background refetching without showing loading indicators
 * These queries will refetch in the background to keep data fresh
 */
export const getBackgroundRefetchKeys = (userId: string) => [
  queryKeys.flipbooks.byUser(userId),
  queryKeys.users.profile(userId),
];