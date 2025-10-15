/**
 * Query key factory for consistent cache invalidation
 * 
 * This provides a structured approach to query keys that enables:
 * - Precise cache invalidation
 * - Easy debugging of cached data
 * - Consistent naming across the application
 */

export const queryKeys = {
  // User-related queries
  users: {
    all: ['users'] as const,
    profile: (userId: string) => ['users', 'profile', userId] as const,
  },
  
  // Flipbook-related queries
  flipbooks: {
    all: ['flipbooks'] as const,
    byUser: (userId: string) => ['flipbooks', 'user', userId] as const,
    detail: (flipbookId: string) => ['flipbooks', 'detail', flipbookId] as const,
    public: () => ['flipbooks', 'public'] as const,
  },
  
  // Authentication-related queries
  auth: {
    session: ['auth', 'session'] as const,
    profile: ['auth', 'profile'] as const,
  },
} as const;

/**
 * Helper function to invalidate all flipbook queries for a specific user
 */
export const getFlipbookInvalidationKeys = (userId: string) => [
  queryKeys.flipbooks.byUser(userId),
  queryKeys.flipbooks.all,
];

/**
 * Helper function to invalidate user profile queries
 */
export const getUserProfileInvalidationKeys = (userId: string) => [
  queryKeys.users.profile(userId),
  queryKeys.auth.profile,
];