# Requirements Document

## Introduction

This feature implements a subscription plan system that controls user access to flipbook creation based on their plan tier. The system will add plan information to user profiles and enforce upload limits, with free users limited to 3 flipbooks and the ability to upgrade for unlimited access.

## Requirements

### Requirement 1

**User Story:** As a free plan user, I want to be clearly informed of my flipbook limit, so that I understand the constraints of my current plan.

#### Acceptance Criteria

1. WHEN a free plan user views their dashboard THEN the system SHALL display their current flipbook count and limit (e.g., "2/3 flipbooks")
2. WHEN a free plan user has created 3 flipbooks THEN the system SHALL display a message indicating they have reached their limit
3. IF a user has no plan assigned THEN the system SHALL default them to the free plan with 3 flipbook limit

### Requirement 2

**User Story:** As a free plan user, I want to be prevented from uploading more than 3 flipbooks, so that the system enforces plan limits consistently.

#### Acceptance Criteria

1. WHEN a free plan user attempts to upload a 4th flipbook THEN the system SHALL block the upload and display an error message
2. WHEN a free plan user reaches their limit THEN the system SHALL suggest upgrading their plan
3. WHEN the upload is blocked THEN the system SHALL NOT process the file or create any database entries

### Requirement 3

**User Story:** As a system administrator, I want user plan information stored in the profiles table, so that plan data is centrally managed and easily accessible.

#### Acceptance Criteria

1. WHEN a new user registers THEN the system SHALL assign them the "free" plan by default
2. WHEN user profile data is fetched THEN the system SHALL include the plan information
3. IF a user's plan is updated THEN the system SHALL immediately reflect the new limits in their session

### Requirement 4

**User Story:** As a premium plan user, I want unlimited flipbook creation, so that I can fully utilize the service without restrictions.

#### Acceptance Criteria

1. WHEN a premium plan user uploads flipbooks THEN the system SHALL NOT enforce any upload limits
2. WHEN a premium plan user views their dashboard THEN the system SHALL indicate unlimited access
3. IF a user upgrades from free to premium THEN the system SHALL immediately remove upload restrictions

### Requirement 5

**User Story:** As a user, I want my plan information to be consistently available throughout the application, so that features can respond appropriately to my subscription level.

#### Acceptance Criteria

1. WHEN a user logs in THEN the system SHALL fetch and store their plan information in the authentication context
2. WHEN plan information is needed by components THEN the system SHALL provide it through the authentication context
3. IF plan information fails to load THEN the system SHALL default to free plan restrictions for security