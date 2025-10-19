# Component Architecture Guide

This document outlines the component architecture patterns used in the application for maintainable, reusable, and focused components.

## Architecture Principles

### 1. Single Responsibility Principle
Each component should have one clear responsibility:
- **FlipbookCard**: Displays a single flipbook with actions
- **StatsCard**: Shows aggregated statistics
- **PlanStatus**: Displays user plan information

### 2. Separation of Concerns
Business logic is separated from presentation:
- **Custom Hooks**: Handle business logic and state management
- **Components**: Focus on rendering and user interaction
- **Utilities**: Provide reusable functionality

### 3. Composition over Inheritance
Components are composed together rather than extended:
```tsx
// Good: Composition
<Dashboard>
  <PlanStatus />
  <FlipbookGrid>
    <FlipbookCard />
  </FlipbookGrid>
  <StatsCard />
</Dashboard>

// Avoid: Large monolithic components
<DashboardWithEverything />
```

## Component Patterns

### Memoized Components
Use `React.memo` for components that receive stable props:

```tsx
export const FlipbookCard = React.memo<FlipbookCardProps>(({ flipbook, onDelete, onShare }) => {
  // Component implementation
});

FlipbookCard.displayName = 'FlipbookCard';
```

**When to use:**
- Components that render frequently
- Components with expensive calculations
- Components in lists or grids

### Custom Hooks for Business Logic
Extract complex logic into custom hooks:

```tsx
// useDashboardActions.ts
export const useDashboardActions = ({ flipbooks, userId, planContext }) => {
  const handleDeleteFlipbook = useCallback(async (flipbookId: string) => {
    // Business logic here
  }, [dependencies]);

  return {
    handleDeleteFlipbook,
    handleShareFlipbook,
    formatDate,
    isDeleting,
  };
};
```

**Benefits:**
- Reusable across components
- Easier to test
- Cleaner component code
- Better separation of concerns

### Prop Interface Design
Design clear, focused prop interfaces:

```tsx
interface FlipbookCardProps {
  flipbook: Flipbook;
  onDelete: (id: string) => void;
  onShare: (id: string) => void;
  formatDate: (date: string) => string;
  isDeleting: boolean;
}
```

**Guidelines:**
- Use specific types over `any`
- Include callback functions for actions
- Pass formatted data rather than raw data when possible
- Keep prop lists focused and minimal

## File Organization

### Component Files
```
src/components/
├── FlipbookCard.tsx       # Single flipbook display
├── StatsCard.tsx          # Statistics display
├── PlanStatus.tsx         # Plan information
└── ui/                    # Base UI components
    ├── button.tsx
    ├── card.tsx
    └── badge.tsx
```

### Hook Files
```
src/hooks/
├── useDashboardActions.ts # Dashboard-specific actions
├── useFlipbooks.ts        # Flipbook data management
└── usePermissions.ts      # Permission checking
```

### Utility Files
```
src/lib/
├── debugUtils.ts          # Development utilities
├── errorHandling.ts       # Error management
└── planManager.ts         # Plan validation
```

## Best Practices

### 1. Component Naming
- Use PascalCase for components
- Use descriptive names that indicate purpose
- Avoid generic names like `Item` or `Container`

### 2. Hook Naming
- Start with `use` prefix
- Describe what the hook manages: `useDashboardActions`
- Group related functionality together

### 3. Props and State
- Minimize prop drilling by using composition
- Use custom hooks to share state logic
- Pass callbacks for actions rather than exposing internal state

### 4. Performance Optimization
- Use `React.memo` for expensive components
- Use `useCallback` for stable function references
- Use `useMemo` for expensive calculations
- Avoid creating objects/functions in render

### 5. Error Handling
- Use centralized error handling utilities
- Provide meaningful error messages
- Handle edge cases gracefully

## Testing Strategy

### Component Testing
Focus on behavior rather than implementation:

```tsx
test('FlipbookCard displays flipbook information', () => {
  render(<FlipbookCard flipbook={mockFlipbook} {...mockProps} />);
  expect(screen.getByText(mockFlipbook.title)).toBeInTheDocument();
});

test('FlipbookCard calls onDelete when delete button is clicked', () => {
  const onDelete = jest.fn();
  render(<FlipbookCard {...mockProps} onDelete={onDelete} />);
  fireEvent.click(screen.getByRole('button', { name: /delete/i }));
  expect(onDelete).toHaveBeenCalledWith(mockFlipbook.id);
});
```

### Hook Testing
Test hooks in isolation using `@testing-library/react-hooks`:

```tsx
test('useDashboardActions handles delete correctly', async () => {
  const { result } = renderHook(() => useDashboardActions(mockProps));
  
  await act(async () => {
    await result.current.handleDeleteFlipbook('flipbook-id');
  });
  
  expect(mockDeleteMutation).toHaveBeenCalled();
});
```

## Migration Guide

When refactoring existing components:

1. **Identify Responsibilities**: Break down what the component does
2. **Extract Components**: Create focused components for each responsibility
3. **Extract Hooks**: Move business logic to custom hooks
4. **Update Imports**: Update parent components to use new structure
5. **Test**: Ensure functionality remains the same
6. **Document**: Update documentation and add comments

## Common Patterns

### Loading States
```tsx
const LoadingWrapper = ({ isLoading, children, fallback }) => {
  if (isLoading) return fallback;
  return children;
};
```

### Error Boundaries
```tsx
const ErrorBoundary = ({ children, fallback }) => {
  // Error boundary implementation
};
```

### Conditional Rendering
```tsx
const ConditionalRender = ({ condition, children, fallback = null }) => {
  return condition ? children : fallback;
};
```

This architecture promotes maintainable, testable, and reusable code while keeping components focused on their specific responsibilities.