# Design Document

## Overview

This design addresses critical performance and authentication issues in the dashboard by implementing optimized data fetching, proper error handling, efficient authentication state management, and improved user experience patterns.

## Architecture

### Current Issues Identified
1. **Profile Fetching Race Conditions**: The AuthContext fetches/creates profiles multiple times due to auth state changes
2. **Inefficient Dashboard Loading**: Dashboard waits for all data before showing any UI
3. **Sign Out Flow Issues**: Missing proper cleanup and navigation after sign out
4. **No Query Optimization**: Database queries lack proper caching and error boundaries

### Proposed Architecture
- **React Query Integration**: Leverage existing React Query for data caching and background updates
- **Optimistic UI Updates**: Show UI immediately with loading states for individual components
- **Error Boundaries**: Implement proper error handling at component level
- **Authentication Flow Optimization**: Reduce redundant profile fetches and improve state management

## Components and Interfaces

### Enhanced AuthContext
```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoadingProfile: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

**Key Changes:**
- Add `isLoadingProfile` state to prevent multiple profile fetches
- Add `refreshProfile` method for manual profile updates
- Implement proper cleanup in signOut method
- Add debouncing for profile fetch operations

### Optimized Dashboard Component
```typescript
interface DashboardState {
  flipbooks: Flipbook[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}
```

**Key Changes:**
- Use React Query for flipbook data management
- Implement progressive loading (show header while data loads)
- Add proper error boundaries and retry mechanisms
- Cache flipbook data to prevent unnecessary refetches

### Enhanced Navigation Component
**Key Changes:**
- Add loading state for sign out operation
- Implement proper navigation after sign out
- Add error handling for sign out failures

## Data Models

### Profile Management
- **Caching Strategy**: Cache profile data in React Query with 5-minute stale time
- **Fallback Handling**: Graceful degradation when profile creation fails
- **Update Strategy**: Optimistic updates for profile changes

### Flipbook Data
- **Query Key Structure**: `['flipbooks', userId]` for proper cache invalidation
- **Pagination**: Implement cursor-based pagination for large datasets
- **Background Updates**: Enable background refetching with stale-while-revalidate pattern

## Error Handling

### Authentication Errors
1. **Profile Creation Failures**: Fallback to default free plan with user notification
2. **Sign Out Failures**: Show error toast and retry option
3. **Session Expiry**: Automatic redirect to login with session restoration

### Data Fetching Errors
1. **Network Errors**: Show retry button with exponential backoff
2. **Database Errors**: Display user-friendly error messages
3. **Timeout Errors**: Implement request timeout with retry logic

### UI Error States
1. **Loading States**: Skeleton loaders for better perceived performance
2. **Empty States**: Clear messaging when no data is available
3. **Error States**: Actionable error messages with retry options

## Testing Strategy

### Unit Tests
- AuthContext state management and profile fetching logic
- Dashboard component loading and error states
- Navigation sign out functionality

### Integration Tests
- Complete authentication flow from login to dashboard
- Data fetching and caching behavior
- Error handling and recovery scenarios

### Performance Tests
- Dashboard loading time measurements
- Profile fetch optimization verification
- Memory leak detection for authentication state changes

## Implementation Approach

### Phase 1: Authentication Optimization
1. Fix AuthContext profile fetching race conditions
2. Implement proper sign out flow with cleanup
3. Add loading states for authentication operations

### Phase 2: Dashboard Performance
1. Implement React Query for flipbook data
2. Add progressive loading and skeleton states
3. Optimize database queries and add error handling

### Phase 3: Error Handling & UX
1. Add comprehensive error boundaries
2. Implement retry mechanisms
3. Add user feedback for all operations

## Performance Optimizations

### React Query Configuration
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
```

### Database Query Optimization
- Add proper indexes on `flipbooks.user_id` and `flipbooks.created_at`
- Implement query result caching at Supabase level
- Use `select` to fetch only required fields

### Memory Management
- Proper cleanup of event listeners in useEffect
- Avoid memory leaks in authentication state management
- Implement proper component unmounting cleanup