# Design Document

## Overview

The FlipFlow application currently has RLS policies in place, but users are experiencing issues with data access. After analyzing the existing schema and policies, the problem appears to be related to policy effectiveness and potential gaps in the current implementation. This design addresses systematic verification, debugging, and enhancement of the existing RLS policies to ensure proper data access control.

## Architecture

### Current State Analysis

The existing database schema includes:
- **Tables**: `profiles`, `flipbooks`, `flipbook_views`, `user_roles`
- **Storage Buckets**: `flipbook-pdfs`, `flipbook-assets`
- **RLS Policies**: Already implemented for all tables and storage buckets
- **Authentication**: Supabase Auth with automatic profile creation

### Problem Identification

Based on the existing policies, the issues are likely caused by:
1. **Policy Logic Gaps**: Some policies may not cover all necessary scenarios
2. **Authentication State**: Users might not be properly authenticated when making requests
3. **Policy Conflicts**: Multiple policies might be interfering with each other
4. **Missing Policies**: Some edge cases might not be covered

### Solution Architecture

The solution involves a systematic approach:
1. **Policy Audit**: Review and test all existing policies
2. **Policy Enhancement**: Fix identified issues and add missing policies
3. **Debugging Tools**: Implement logging and debugging mechanisms
4. **Testing Framework**: Create comprehensive tests for all access patterns

## Components and Interfaces

### 1. Database Policy Management

#### Policy Verification System
- **Purpose**: Systematically test each RLS policy
- **Components**:
  - Policy test queries for each table
  - Authentication state verification
  - Access pattern validation

#### Policy Enhancement Module
- **Purpose**: Fix and improve existing policies
- **Components**:
  - Updated policy definitions
  - Conflict resolution mechanisms
  - Performance optimizations

### 2. Authentication Integration

#### Auth State Verification
- **Purpose**: Ensure proper authentication context
- **Components**:
  - JWT token validation
  - User ID extraction and verification
  - Session state management

#### Profile Management
- **Purpose**: Ensure profiles are properly created and accessible
- **Components**:
  - Enhanced profile creation trigger
  - Profile access validation
  - Upsert operation optimization

### 3. Storage Access Control

#### Bucket Policy Management
- **Purpose**: Ensure proper file access control
- **Components**:
  - Path-based access control
  - User-specific folder structure
  - File operation permissions

### 4. Debugging and Monitoring

#### Policy Debugging Tools
- **Purpose**: Identify and resolve policy issues
- **Components**:
  - Policy execution logging
  - Access attempt monitoring
  - Error reporting mechanisms

## Data Models

### Enhanced Policy Structure

```sql
-- Policy naming convention: {action}_{table}_{scope}
-- Example: select_flipbooks_own_data

-- Policy categories:
-- 1. Own Data Access (user can access their own data)
-- 2. Public Data Access (anyone can access public data)
-- 3. Admin Access (admins can access all data)
-- 4. Cross-table Access (policies that span multiple tables)
```

### Authentication Context

```sql
-- Standard authentication checks:
-- auth.uid() - Current authenticated user ID
-- auth.jwt() - Full JWT token for advanced checks
-- auth.role() - User role from JWT
```

### Storage Path Structure

```
flipbook-pdfs/
  {user_id}/
    {flipbook_id}.pdf

flipbook-assets/
  {user_id}/
    logos/
      {filename}
    covers/
      {filename}
```

## Error Handling

### Policy Failure Scenarios

1. **Authentication Failures**
   - **Cause**: User not properly authenticated
   - **Detection**: `auth.uid()` returns null
   - **Resolution**: Ensure proper login flow and token refresh

2. **Permission Denied Errors**
   - **Cause**: Policy logic preventing legitimate access
   - **Detection**: Database returns empty results or explicit denial
   - **Resolution**: Review and fix policy conditions

3. **Cross-table Access Issues**
   - **Cause**: Policies not properly handling joins or references
   - **Detection**: Queries involving multiple tables fail
   - **Resolution**: Implement proper cross-table policy logic

### Error Monitoring

```sql
-- Enable query logging for policy debugging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 0;

-- Create audit table for access attempts
CREATE TABLE IF NOT EXISTS policy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  table_name TEXT,
  operation TEXT,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Testing Strategy

### 1. Policy Unit Tests

Test each policy individually:
- **Positive Tests**: Verify legitimate access is allowed
- **Negative Tests**: Verify unauthorized access is denied
- **Edge Cases**: Test boundary conditions and special scenarios

### 2. Integration Tests

Test complete user workflows:
- **User Registration**: Profile creation and initial access
- **Flipbook Creation**: Full creation workflow including file upload
- **Data Retrieval**: Fetching user's own data and public data
- **Data Modification**: Updates and deletions

### 3. Authentication State Tests

Test different authentication scenarios:
- **Authenticated Users**: Normal logged-in state
- **Unauthenticated Users**: Anonymous access patterns
- **Expired Sessions**: Token refresh scenarios
- **Invalid Tokens**: Malformed or tampered tokens

### 4. Performance Tests

Ensure policies don't impact performance:
- **Query Performance**: Measure policy overhead
- **Index Optimization**: Ensure proper indexing for policy conditions
- **Concurrent Access**: Test multiple users accessing data simultaneously

## Implementation Phases

### Phase 1: Audit and Diagnosis
1. Create policy testing framework
2. Test all existing policies systematically
3. Identify specific failure points
4. Document current vs expected behavior

### Phase 2: Policy Enhancement
1. Fix identified policy issues
2. Add missing policies for edge cases
3. Optimize policy performance
4. Implement proper error handling

### Phase 3: Debugging Infrastructure
1. Add policy execution logging
2. Create monitoring dashboards
3. Implement automated policy testing
4. Set up alerting for policy failures

### Phase 4: Validation and Documentation
1. Comprehensive testing of all access patterns
2. Performance validation
3. Security audit of all policies
4. Complete documentation of policy logic

## Security Considerations

### Principle of Least Privilege
- Users can only access their own data by default
- Public access is explicitly granted only where needed
- Admin access is properly controlled and audited

### Data Isolation
- User data is completely isolated using user_id checks
- Storage paths enforce user-specific folder structure
- Cross-user data access is prevented at the database level

### Audit Trail
- All access attempts are logged for security monitoring
- Policy changes are tracked and versioned
- Failed access attempts trigger security alerts

## Performance Optimization

### Index Strategy
```sql
-- Ensure proper indexing for policy conditions
CREATE INDEX IF NOT EXISTS idx_flipbooks_user_id ON flipbooks(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
```

### Policy Optimization
- Use efficient policy conditions that leverage indexes
- Avoid complex subqueries in policy definitions where possible
- Cache authentication context to reduce repeated lookups