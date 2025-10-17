# Implementation Plan

- [x] 1. Create database migration for plan column




  - Create SQL migration file to add plan column to profiles table with default 'free' value
  - Ensure the migration is compatible with existing data
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Create plan configuration constants





  - Define PLAN_LIMITS constant with free and premium plan configurations
  - Create TypeScript types for plan-related data structures
  - _Requirements: 1.3, 4.1, 4.2_

- [x] 3. Update Supabase types to include plan field





  - Regenerate or manually update the types.ts file to include the new plan column
  - Ensure Profile type includes the plan field with proper typing
  - _Requirements: 3.1, 5.1_

- [x] 4. Enhance AuthContext to fetch profile data





  - [x] 4.1 Extend AuthContextType interface to include profile


    - Add profile field to the context interface
    - Update context provider value to include profile state
    - _Requirements: 5.1, 5.2_
  
  - [x] 4.2 Implement profile fetching logic in AuthProvider


    - Add profile state management to AuthProvider
    - Fetch profile data when user authenticates
    - Handle profile creation/upsert for new users
    - _Requirements: 3.1, 3.2, 5.1_
  
  - [x] 4.3 Add error handling and fallback behavior


    - Implement fallback to free plan when profile fetch fails
    - Add error logging for profile-related issues
    - _Requirements: 5.3_

- [ ]* 4.4 Write unit tests for AuthContext profile functionality
  - Test profile fetching on authentication
  - Test error handling and fallback behavior
  - Test profile state updates
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5. Update FlipbookUpload component for limit validation




  - [x] 5.1 Add flipbookCount prop to FlipbookUploadProps interface


    - Update component props to accept current flipbook count
    - _Requirements: 2.1, 2.2_
  
  - [x] 5.2 Implement upload limit validation logic


    - Add validation function to check plan limits before upload
    - Integrate plan configuration constants
    - _Requirements: 1.1, 2.1, 2.2, 4.1_
  
  - [x] 5.3 Add limit-reached error handling and messaging


    - Display clear error messages when limits are exceeded
    - Show upgrade suggestions in error messages
    - Prevent upload processing when limits are reached
    - _Requirements: 1.2, 2.2, 2.3_

- [ ]* 5.4 Write unit tests for upload validation
  - Test limit validation for different plans
  - Test error message generation
  - Test upload blocking behavior
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. Update Dashboard component to pass flipbook count




  - [x] 6.1 Modify Dashboard to pass flipbookCount prop to FlipbookUpload


    - Update FlipbookUpload component usage to include flipbooks.length
    - _Requirements: 2.1_
  
  - [x] 6.2 Add plan status display to Dashboard


    - Show current plan and usage information
    - Display flipbook count with limits for free users
    - Show unlimited status for premium users
    - _Requirements: 1.1, 4.2_

- [ ]* 6.3 Write unit tests for Dashboard plan integration
  - Test flipbook count prop passing
  - Test plan status display
  - Test different plan scenarios
  - _Requirements: 1.1, 4.2_

- [x] 7. Execute database migration





  - Run the SQL migration to add the plan column to profiles table
  - Verify all existing profiles have the default 'free' plan value
  - _Requirements: 3.1, 3.2_

- [ ] 8. Integration testing and validation
  - [ ] 8.1 Test complete upload flow for free plan users
    - Verify users can create up to 3 flipbooks
    - Verify 4th upload attempt is blocked with proper error message
    - _Requirements: 1.1, 1.2, 2.1, 2.2_
  
  - [ ] 8.2 Test authentication flow with profile data
    - Verify profile data is fetched and available after login
    - Test new user profile creation
    - _Requirements: 3.2, 5.1, 5.2_
  
  - [ ] 8.3 Test error scenarios and fallback behavior
    - Test behavior when profile fetch fails
    - Verify fallback to free plan restrictions
    - _Requirements: 5.3_