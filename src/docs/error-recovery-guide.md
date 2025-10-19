# Error Recovery Patterns Guide

This guide explains how to use the comprehensive error recovery system implemented in FlipFlow. The system provides automatic error classification, retry mechanisms with exponential backoff, and user-friendly guidance for error resolution.

## Overview

The error recovery system consists of several key components:

1. **Error Classification** - Automatically categorizes errors by type and severity
2. **Recovery Patterns** - Predefined strategies for handling different error types
3. **Retry Mechanisms** - Exponential backoff with jitter for transient failures
4. **User Guidance** - Actionable feedback and recovery instructions
5. **Notification Management** - Prevents duplicate error messages

## Quick Start

### Basic Usage with useErrorHandler Hook

```typescript
import { useErrorHandler } from "@/lib/errorHandling";

const MyComponent = () => {
  const { handleAsyncOperation, retryWithRecoveryPattern } = useErrorHandler();

  const handleOperation = async () => {
    // Automatic error handling with recovery
    const result = await handleAsyncOperation(
      () => someAsyncOperation(),
      {
        component: "MyComponent",
        operation: "someOperation",
        userId: user?.id,
      },
      {
        attemptRecovery: true,
        maxRetries: 3,
      }
    );

    if (result) {
      // Operation succeeded
      console.log("Success:", result);
    }
  };
};
```

### Using Common Recovery Flows

```typescript
import {
  withDatabaseRecovery,
  withUploadRecovery,
} from "@/lib/commonRecoveryFlows";

// Database operation with automatic retry
const data = await withDatabaseRecovery(
  () => supabase.from("table").select("*"),
  { component: "MyComponent", operation: "fetchData" },
  {
    maxRetries: 3,
    onProgress: (attempt, max) => console.log(`Retry ${attempt}/${max}`),
  }
);

// File upload with progress tracking
const uploadResult = await withUploadRecovery(
  () => uploadFile(file),
  { component: "Upload", operation: "uploadFile" },
  {
    maxRetries: 2,
    showUserFeedback: true,
  }
);
```

## Error Types and Recovery Patterns

### 1. Network Errors

**Characteristics:**

- Connection timeouts
- Network unavailable
- DNS resolution failures

**Recovery Strategy:**

- Exponential backoff retry (1s, 2s, 4s)
- Network connectivity check
- User guidance for connection issues

**Example:**

```typescript
const { handleAsyncOperation } = useErrorHandler();

const fetchData = async () => {
  return handleAsyncOperation(
    () => fetch("/api/data").then((r) => r.json()),
    { component: "DataFetcher", operation: "fetchData" },
    { attemptRecovery: true, maxRetries: 3 }
  );
};
```

### 2. Authentication Errors

**Characteristics:**

- Invalid tokens
- Expired sessions
- Unauthorized access

**Recovery Strategy:**

- Automatic session refresh
- Clear corrupted auth data
- Redirect to sign-in page

**Example:**

```typescript
import { withAuthRecovery } from "@/lib/commonRecoveryFlows";

const authenticatedOperation = async () => {
  return withAuthRecovery(() => supabase.from("private_table").select("*"), {
    component: "PrivateData",
    operation: "fetch",
  });
};
```

### 3. Server Errors

**Characteristics:**

- 500 Internal Server Error
- Database connection failures
- Service unavailable

**Recovery Strategy:**

- Retry with longer delays (2s, 5s)
- Server health check
- Fallback to cached data if available

**Example:**

```typescript
const { retryWithRecoveryPattern } = useErrorHandler();

const serverOperation = async () => {
  return retryWithRecoveryPattern(
    () => performServerOperation(),
    { component: "ServerOp", operation: "process" },
    { maxRetries: 2, baseDelay: 2000 }
  );
};
```

### 4. Validation Errors

**Characteristics:**

- Invalid input data
- Missing required fields
- Format violations

**Recovery Strategy:**

- No automatic retry
- Focus on first invalid input
- Clear validation messages

**Example:**

```typescript
const { handleError, classifyError } = useErrorHandler();

const validateAndSubmit = async (data) => {
  try {
    await submitForm(data);
  } catch (error) {
    const classification = classifyError(error);
    if (classification.type === "validation") {
      // Handle validation errors specifically
      handleError(error, { component: "Form", operation: "submit" });
      // Focus on first invalid field
      document.querySelector("input:invalid")?.focus();
    }
  }
};
```

### 5. Permission Errors

**Characteristics:**

- Access denied (403)
- Plan limits exceeded
- Insufficient permissions

**Recovery Strategy:**

- No automatic retry
- Show upgrade prompts
- Contact support guidance

**Example:**

```typescript
const { handleAsyncOperation } = useErrorHandler();

const restrictedOperation = async () => {
  return handleAsyncOperation(
    () => performRestrictedAction(),
    { component: "Premium", operation: "restrictedAction" },
    { attemptRecovery: false } // No retry for permission errors
  );
};
```

## Advanced Usage

### Custom Recovery Patterns

You can register custom recovery patterns for specific error scenarios:

```typescript
import { errorRecoveryManager } from "@/lib/errorRecovery";

const customRecoveryPattern = {
  name: "custom-api",
  canHandle: (error) => {
    return error.message.includes("CUSTOM_API_ERROR");
  },
  recover: async (error, context) => {
    // Custom recovery logic
    try {
      await performCustomRecovery();
      return {
        success: true,
        message: "Custom recovery successful",
        shouldRetry: true,
      };
    } catch (recoveryError) {
      return {
        success: false,
        message: "Custom recovery failed",
        shouldRetry: false,
      };
    }
  },
  userGuidance: {
    title: "Custom API Error",
    description: "There was an issue with the custom API.",
    actions: [
      {
        label: "Retry",
        action: () => window.location.reload(),
        primary: true,
      },
    ],
  },
};

errorRecoveryManager.registerPattern(customRecoveryPattern);
```

### Batch Operations with Partial Failure Recovery

```typescript
import { withBatchRecovery } from "@/lib/commonRecoveryFlows";

const processBatch = async (items) => {
  const result = await withBatchRecovery(
    items,
    (item) => processItem(item),
    { component: "BatchProcessor", operation: "processBatch" },
    {
      continueOnFailure: true,
      failureThreshold: 25, // Stop if >25% fail
      onProgress: (processed, total) => {
        console.log(`Progress: ${processed}/${total}`);
      },
    }
  );

  console.log(
    `Processed: ${result.successful.length} successful, ${result.failed.length} failed`
  );
  return result;
};
```

### Critical Operations with Fallbacks

```typescript
import { withCriticalOperationRecovery } from "@/lib/commonRecoveryFlows";

const criticalDataSave = async (data) => {
  return withCriticalOperationRecovery(
    () => saveToDatabase(data),
    { component: "DataSaver", operation: "criticalSave" },
    {
      maxRetries: 2,
      criticalityLevel: "critical",
      fallbackOperation: () => saveToLocalStorage(data),
      onRecovery: (type) => {
        if (type === "critical-operation-fallback") {
          // Notify user that data was saved locally
          showNotification("Data saved locally due to connection issues");
        }
      },
    }
  );
};
```

## Best Practices

### 1. Choose Appropriate Recovery Strategies

- **Network operations**: Use `withNetworkRecovery` for API calls
- **Database operations**: Use `withDatabaseRecovery` for Supabase queries
- **File uploads**: Use `withUploadRecovery` for file operations
- **Authentication**: Use `withAuthRecovery` for auth-required operations

### 2. Provide Context Information

Always provide meaningful context for better error tracking:

```typescript
const context = {
  component: "ComponentName",
  operation: "specificOperation",
  userId: user?.id,
  metadata: {
    itemId: "item-123",
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
  },
};
```

### 3. Handle User Feedback Appropriately

- Set `showUserFeedback: false` for background operations
- Use `onProgress` callbacks for long-running operations
- Provide `onRecovery` callbacks for success notifications

### 4. Configure Retry Parameters

- **Fast operations**: `maxRetries: 3, baseDelay: 1000`
- **Slow operations**: `maxRetries: 2, baseDelay: 3000`
- **Critical operations**: `maxRetries: 2, baseDelay: 5000`

### 5. Error Reporting and Monitoring

```typescript
const { handleError } = useErrorHandler();

// Configure error reporting
handleError(error, context, {
  showToast: true, // Show user notification
  logError: true, // Log to console
  reportError: true, // Send to monitoring service
  attemptRecovery: true, // Try automatic recovery
});
```

## Testing Error Recovery

Use the `ErrorRecoveryFlows` component to test different error scenarios:

```typescript
import ErrorRecoveryFlows from "@/components/ErrorRecoveryFlows";

// Add to your development/testing page
<ErrorRecoveryFlows />;
```

This component provides interactive demos for:

- Network error recovery
- Authentication error handling
- Server error retry logic
- Validation error guidance
- Permission error flows
- Success after retry scenarios

## Monitoring and Debugging

### Error Statistics

```typescript
const { getErrorStats } = useErrorHandler();

const stats = getErrorStats();
console.log("Error statistics:", {
  total: stats.total,
  byType: stats.byType,
  bySeverity: stats.bySeverity,
  recent: stats.recent,
});
```

### Recovery Pattern Information

```typescript
import { errorRecoveryManager } from "@/lib/errorRecovery";

const patterns = errorRecoveryManager.getPatterns();
console.log(
  "Available recovery patterns:",
  patterns.map((p) => p.name)
);
```

## Migration Guide

If you have existing error handling code, here's how to migrate:

### Before (Basic Error Handling)

```typescript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  console.error("Operation failed:", error);
  toast.error("Something went wrong");
  return null;
}
```

### After (With Recovery Patterns)

```typescript
const { handleAsyncOperation } = useErrorHandler();

const result = await handleAsyncOperation(
  () => someOperation(),
  { component: "MyComponent", operation: "someOperation" },
  { attemptRecovery: true, maxRetries: 3 }
);

return result; // null if failed after recovery attempts
```

This migration provides:

- Automatic error classification
- Intelligent retry logic
- User-friendly error messages
- Recovery guidance
- Error reporting and monitoring

## Conclusion

The error recovery system provides a robust foundation for handling errors gracefully while maintaining a good user experience. By using the provided patterns and utilities, you can ensure that your application handles failures intelligently and guides users toward resolution.

For more examples and advanced usage, refer to the implementation in existing components like `Dashboard`, `FlipbookUpload`, and `AuthContext`.
