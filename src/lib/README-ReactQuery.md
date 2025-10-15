# React Query Configuration

This directory contains the optimized React Query configuration for better caching and performance.

## Files Overview

### `queryClient.ts`
- **Purpose**: Centralized QueryClient configuration with optimized settings
- **Features**:
  - 5-minute stale time for better caching
  - 10-minute garbage collection time
  - Exponential backoff retry strategy (3 retries, max 30s delay)
  - Background refetching on window focus and reconnect

### `queryKeys.ts`
- **Purpose**: Structured query key factory for consistent cache invalidation
- **Features**:
  - Hierarchical query key structure
  - Type-safe query keys with `as const`
  - Helper functions for cache invalidation
  - Organized by feature (users, flipbooks, auth)

### `queryUtils.ts`
- **Purpose**: Common utilities and options for queries and mutations
- **Features**:
  - Predefined query options for different data types
  - Consistent error handling
  - Helper functions for creating query options

## Usage Examples

### Basic Query Hook
```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { queryOptions } from '@/lib/queryUtils';

export const useFlipbooks = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.flipbooks.byUser(userId),
    queryFn: () => fetchFlipbooks(userId),
    ...queryOptions.flipbooks,
  });
};
```

### Mutation with Cache Invalidation
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getFlipbookInvalidationKeys } from '@/lib/queryKeys';

export const useDeleteFlipbook = (userId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteFlipbook,
    onSuccess: () => {
      const keys = getFlipbookInvalidationKeys(userId);
      keys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
};
```

## Query Key Structure

```
users/
├── all: ['users']
└── profile: ['users', 'profile', userId]

flipbooks/
├── all: ['flipbooks']
├── byUser: ['flipbooks', 'user', userId]
├── detail: ['flipbooks', 'detail', flipbookId]
└── public: ['flipbooks', 'public']

auth/
├── session: ['auth', 'session']
└── profile: ['auth', 'profile']
```

## Cache Configuration

| Data Type | Stale Time | GC Time | Use Case |
|-----------|------------|---------|----------|
| Profile   | 10 min     | 30 min  | Rarely changes |
| Flipbooks | 5 min      | 10 min  | Moderate changes |
| Realtime  | 30 sec     | 2 min   | Frequent updates |

## Error Handling

All queries use consistent error handling:
- Automatic retry with exponential backoff
- Graceful error messages
- Supabase error parsing
- Component-level error boundaries

## Performance Benefits

1. **Reduced API Calls**: 5-minute stale time prevents unnecessary refetches
2. **Background Updates**: Data stays fresh without blocking UI
3. **Smart Caching**: Different cache times based on data volatility
4. **Optimistic Updates**: Immediate UI feedback for mutations
5. **Proper Invalidation**: Precise cache updates when data changes

## Migration Guide

To migrate existing useState/useEffect patterns:

1. Replace `useState` + `useEffect` with `useQuery`
2. Use structured query keys from `queryKeys.ts`
3. Apply appropriate cache options from `queryOptions`
4. Handle loading/error states through query result
5. Use mutations for data modifications with proper invalidation