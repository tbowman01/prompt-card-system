# Parallel Test Execution System

A comprehensive queue-based parallel test execution system with intelligent resource management and real-time progress tracking.

## Overview

The parallel test execution system enables efficient execution of multiple prompt test cases simultaneously, with proper resource management and progress tracking. Built on Bull.js with Redis for queue management and includes sophisticated concurrency control.

## Architecture

### Core Components

1. **TestQueueManager** - Main orchestrator for parallel test execution
2. **ResourceManager** - Intelligent system resource monitoring and allocation
3. **Semaphore** - Concurrency control for test execution
4. **ProgressService** - Real-time progress updates via WebSocket

### Key Features

- **Queue-based execution** with priority support
- **Resource-aware scheduling** to prevent system overload
- **Real-time progress tracking** with WebSocket updates
- **Configurable concurrency** limits per execution
- **Graceful error handling** and recovery
- **Cancellation support** for long-running executions
- **Comprehensive logging** and monitoring

## API Endpoints

### Queue Test Execution
```http
POST /api/parallel-test-execution/queue
Content-Type: application/json

{
  "prompt_card_id": 1,
  "test_case_ids": [1, 2, 3, 4, 5],
  "model": "llama3",
  "configuration": {
    "max_concurrent_tests": 3,
    "timeout_per_test": 30000,
    "stop_on_first_failure": false,
    "resource_limits": {
      "memory_mb": 512,
      "cpu_percent": 20
    }
  },
  "priority": 5
}
```

### Get Execution Progress
```http
GET /api/parallel-test-execution/{executionId}/progress
```

### Get Active Executions
```http
GET /api/parallel-test-execution/active
```

### Cancel Execution
```http
DELETE /api/parallel-test-execution/{executionId}
```

### Get Queue Statistics
```http
GET /api/parallel-test-execution/queue/stats
```

### Get Test Results
```http
GET /api/parallel-test-execution/{executionId}/results
```

### Get System Resources
```http
GET /api/parallel-test-execution/system/resources
```

### Batch Execute Multiple Prompt Cards
```http
POST /api/parallel-test-execution/batch
Content-Type: application/json

{
  "executions": [
    {
      "prompt_card_id": 1,
      "test_case_ids": [1, 2, 3],
      "model": "llama3",
      "priority": 5
    },
    {
      "prompt_card_id": 2,
      "test_case_ids": [4, 5, 6],
      "model": "mistral",
      "priority": 3
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Resource Limits
MAX_CONCURRENT_TESTS=10
MAX_CPU_PERCENT=80
MAX_MEMORY_MB=4096

# WebSocket
CORS_ORIGIN=http://localhost:3000
```

### Test Configuration Options

```typescript
interface TestConfiguration {
  max_concurrent_tests: number;      // Max parallel tests per execution
  timeout_per_test: number;          // Timeout per test in milliseconds
  retry_failed_tests: boolean;       // Whether to retry failed tests
  max_retries: number;               // Maximum retry attempts
  stop_on_first_failure: boolean;    // Stop execution on first failure
  resource_limits: {
    memory_mb: number;               // Memory limit per execution
    cpu_percent: number;             // CPU limit per execution
  };
  cache_enabled: boolean;            // Enable response caching
  progress_updates: boolean;         // Enable real-time progress updates
}
```

## Resource Management

### Intelligent Resource Allocation

The system monitors:
- CPU usage percentage
- Memory utilization
- Active test count
- System load average

### Resource Limits

```typescript
interface ResourceLimits {
  max_cpu_percent: number;           // Maximum CPU usage (default: 80%)
  max_memory_mb: number;             // Maximum memory usage
  max_concurrent_tests: number;      // Maximum concurrent tests
  emergency_threshold_cpu: number;   // Emergency CPU threshold (default: 90%)
  emergency_threshold_memory: number; // Emergency memory threshold
}
```

### Priority-Based Scheduling

- **Critical**: Can use emergency thresholds
- **High**: Higher queue priority
- **Medium**: Standard priority
- **Low**: Lower queue priority

## Real-Time Updates

### WebSocket Events

```typescript
// Subscribe to test execution updates
socket.emit('subscribe-test', executionId);

// Receive progress updates
socket.on('progress', (progress) => {
  console.log(`Progress: ${progress.percent}%`);
});

// Receive completion notification
socket.on('test-complete', (result) => {
  console.log('Test completed:', result);
});

// Subscribe to system resources
socket.emit('subscribe-system-resources');
socket.on('system-resources', (resources) => {
  console.log('System resources:', resources);
});
```

## Error Handling

### Graceful Degradation

1. **Resource Constraints**: Queue tests when resources are limited
2. **Redis Unavailable**: Fallback to in-memory execution
3. **Test Timeouts**: Individual test timeouts with proper cleanup
4. **System Overload**: Automatic throttling and load balancing

### Error Recovery

- Automatic retry with exponential backoff
- Failed job cleanup and resource release
- Graceful shutdown with job completion

## Performance Optimizations

### Concurrency Control

- **Semaphore-based** limiting prevents resource exhaustion
- **Adaptive concurrency** based on system resources
- **Queue-based scheduling** with priority support

### Caching

- **Response caching** for repeated prompts
- **Model warming** for frequently used models
- **Result caching** for duplicate test cases

### Monitoring

- **Real-time metrics** collection
- **Performance bottleneck** detection
- **Resource utilization** tracking

## Testing

### Run Test Suite

```bash
# Run comprehensive test suite
npx tsx src/services/testing/test-parallel-execution.ts

# Run specific component tests
npm test -- --grep "TestQueueManager"
```

### Test Components

1. **Semaphore functionality** - Concurrency control
2. **Resource management** - System resource monitoring
3. **Queue operations** - Job queuing and processing
4. **Performance benchmarks** - Parallel vs sequential execution

## Deployment

### Prerequisites

- Redis server running
- Node.js 18+
- Sufficient system resources

### Production Setup

1. **Configure Redis cluster** for high availability
2. **Set resource limits** appropriate for your system
3. **Monitor queue performance** and adjust concurrency
4. **Set up alerts** for resource thresholds

### Scaling

- **Horizontal scaling**: Multiple backend instances
- **Redis clustering**: Distributed queue management
- **Load balancing**: Distribute test executions across instances

## Monitoring and Debugging

### Key Metrics

- Queue wait times
- Test execution rates
- Resource utilization
- Error rates
- Completion times

### Debugging

1. **Check queue statistics** for bottlenecks
2. **Monitor resource usage** for constraints
3. **Review error logs** for failure patterns
4. **Analyze execution times** for optimization opportunities

### Health Checks

```http
GET /api/parallel-test-execution/queue/stats
GET /api/parallel-test-execution/system/resources
```

## Future Enhancements

### Planned Features

1. **Distributed execution** across multiple machines
2. **Advanced scheduling** algorithms
3. **Cost optimization** for different LLM providers
4. **A/B testing** support for prompt variations
5. **Machine learning** for performance prediction

### Performance Targets

- **3-5x speedup** vs sequential execution
- **<100ms latency** for queue operations
- **99.9% uptime** for production deployments
- **Linear scaling** with additional resources

## Contributing

When contributing to the parallel execution system:

1. **Run tests** before submitting changes
2. **Update documentation** for new features
3. **Monitor performance** impact of changes
4. **Follow error handling** patterns
5. **Add comprehensive logging** for debugging

## License

This parallel test execution system is part of the Prompt Card System project.