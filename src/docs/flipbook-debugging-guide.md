# Flipbook Debugging Tools Guide

This guide explains how to use the comprehensive debugging tools implemented for flipbook loading operations.

## Overview

The debugging tools provide developers with powerful capabilities to:

- Simulate different loading scenarios
- Monitor performance metrics in real-time
- Profile operations for bottleneck detection
- Generate optimization suggestions
- Export debug data for analysis

## Accessing Debug Tools

### 1. Debug Panel UI

- **Keyboard Shortcut**: Press `Ctrl+Shift+D` to toggle the debug panel
- **Button**: Click the "Debug Tools" button in the bottom-right corner
- **Console**: Use `window.flipbookDebug.showDebugPanel()`

### 2. Console Commands

All debugging utilities are available through `window.flipbookDebug`:

```javascript
// Show/hide debug panel
window.flipbookDebug.showDebugPanel();
window.flipbookDebug.hideDebugPanel();
window.flipbookDebug.toggleDebugPanel();

// Export debug data
window.flipbookDebug.exportDebugData();

// Performance monitoring
window.flipbookDebug.getPerformanceData();
window.flipbookDebug.getPerformanceSummary();

// Logging
window.flipbookDebug.getLogs();
window.flipbookDebug.clearMetrics();
```

## Debug Panel Features

### Test Scenarios Tab

Simulate different loading conditions:

- **Slow Network**: Adds 5-second delay to network operations
- **Network Errors**: 50% chance of network failures
- **Large PDF**: Simulates 10-second PDF processing
- **PDF Processing Error**: Forces PDF processing failures
- **Timeout**: Triggers timeout after 5 seconds
- **Reset**: Disables all simulations

### Configuration Tab

Control debug behavior:

- **Detailed Logging**: Enable comprehensive console logging
- **PDF Processing Steps**: Log each PDF processing step
- **Performance Profiling**: Enable operation profiling
- **Network Delay**: Adjust simulated network delay (100ms - 10s)
- **Error Rate**: Control error simulation probability (0-100%)

### Performance Tab

Monitor real-time performance:

- **Total Operations**: Count of completed operations
- **Average Load Time**: Mean loading duration
- **Active Operations**: Currently running operations
- **Success Rates**: Loading success percentages by operation
- **Failure Patterns**: Most common error types

### Logs Tab

View detailed debug logs:

- **Real-time Logs**: Live log updates during operations
- **Export Logs**: Download logs as JSON file
- **System Info**: Log browser and network information
- **Filtering**: View logs by level (error, warn, info, debug)

## Programmatic Usage

### Debug Hooks

```typescript
import {
  useFlipbookDebug,
  useFlipbookPDFDebug,
  useFlipbookNetworkDebug,
} from "@/hooks/useFlipbookDebug";

// Main debug hook
const { debugState, actions } = useFlipbookDebug(flipbookId);

// PDF-specific debugging
const pdfDebug = useFlipbookPDFDebug(flipbookId);

// Network-specific debugging
const networkDebug = useFlipbookNetworkDebug(flipbookId);
```

### Performance Profiling

```typescript
import {
  startFlipbookProfiling,
  addFlipbookProfilingPhase,
  endFlipbookProfiling,
} from "@/lib/flipbookProfiler";

// Start profiling
startFlipbookProfiling("myOperation");

// Add phases
addFlipbookProfilingPhase("myOperation", "phase1", { data: "value" });
addFlipbookProfilingPhase("myOperation", "phase2", { data: "value" });

// End profiling and get results
const profile = endFlipbookProfiling("myOperation");
console.log(profile.optimizationSuggestions);
```

### Simulation Controls

```typescript
import {
  simulateSlowNetwork,
  simulateNetworkError,
  simulatePDFError,
  testLoadingScenario,
} from "@/lib/debugUtils";

// Individual simulations
simulateSlowNetwork(3000); // 3 second delay
simulateNetworkError(0.3); // 30% error rate
simulatePDFError(1.0); // 100% error rate

// Predefined scenarios
testLoadingScenario("slow-network");
testLoadingScenario("large-pdf");
testLoadingScenario("reset");
```

## Performance Analysis

### Bottleneck Detection

The profiler automatically detects:

- Operations taking >40% of total time
- Phases slower than 2-second threshold
- Overall operations exceeding 10-second limit

### Optimization Suggestions

Generated suggestions include:

- **Performance**: Caching, progressive loading, CDN usage
- **Reliability**: Error handling, retry mechanisms
- **User Experience**: Loading feedback, cancel options

### Memory Monitoring

Tracks:

- Initial vs. final memory usage
- Memory leak detection (>50MB increase)
- Garbage collection pressure assessment

### Network Analysis

Monitors:

- Connection type and bandwidth
- Latency measurements
- Network efficiency calculations
- Optimization recommendations

## Best Practices

### 1. Development Workflow

1. Enable debug mode: `window.flipbookDebug.enableDebugMode()`
2. Test scenarios systematically
3. Monitor performance metrics
4. Export data for analysis
5. Reset before production testing

### 2. Performance Testing

1. Use "Large PDF" scenario for stress testing
2. Test with "Slow Network" for mobile conditions
3. Monitor success rates during error simulations
4. Profile operations to identify bottlenecks

### 3. Error Analysis

1. Enable detailed logging
2. Simulate various error conditions
3. Review failure patterns in Performance tab
4. Export logs for offline analysis

### 4. Optimization

1. Review profiling results regularly
2. Implement suggested optimizations
3. Measure improvements with before/after profiling
4. Monitor success rates after changes

## Integration with Existing Code

The debugging tools are seamlessly integrated with:

- **FlipbookView**: Automatic profiling and simulation
- **PDF Processing**: Step-by-step logging and error simulation
- **Network Operations**: Delay simulation and error injection
- **Performance Monitoring**: Real-time metrics collection
- **Error Handling**: Enhanced error classification and reporting

## Production Considerations

- All debug tools are automatically disabled in production builds
- Debug code is excluded from production bundles
- Performance impact is minimal in development
- No debug data is collected in production

## Troubleshooting

### Debug Panel Not Showing

- Ensure you're in development mode (`NODE_ENV=development`)
- Check browser console for errors
- Try `window.flipbookDebug.showDebugPanel()` in console

### Simulations Not Working

- Verify debug mode is enabled
- Check configuration in Debug Panel
- Reset simulations and try again

### Performance Data Missing

- Enable performance profiling in configuration
- Ensure operations are completing (not cancelled)
- Check for JavaScript errors in console

## Examples

### Testing Slow Network Conditions

```javascript
// Simulate 3G connection
window.flipbookDebug.simulateSlowNetwork(3000);

// Test flipbook loading
// Observe loading times and user experience

// Reset when done
window.flipbookDebug.resetConfig();
```

### Analyzing Performance Bottlenecks

```javascript
// Enable profiling
window.flipbookDebug.enablePerformanceProfiling();

// Load a flipbook
// Check Performance tab for bottlenecks

// Get optimization suggestions
const suggestions = window.flipbookProfiler.getOptimizationSuggestions();
console.log(suggestions);
```

### Debugging Error Scenarios

```javascript
// Simulate network errors
window.flipbookDebug.simulateError("network", 0.5);

// Enable detailed logging
window.flipbookDebug.enableDetailedLogging();

// Test error handling
// Review logs in Debug Panel

// Export for analysis
window.flipbookDebug.exportLogs();
```

This comprehensive debugging system provides developers with all the tools needed to identify, analyze, and resolve flipbook loading issues efficiently.
