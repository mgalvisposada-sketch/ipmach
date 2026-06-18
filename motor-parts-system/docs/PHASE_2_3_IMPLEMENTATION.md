# Phase 2 & 3 Implementation Guide

## Overview

This document describes the implementation of Phase 2 (Parallel Processing) and Phase 3 (Advanced Optimizations) for the deep web search system.

## Phase 2: Parallel Processing

### Architecture

**ScraperWorkerPool** (`src/lib/scrapers/ScraperWorkerPool.ts`)
- Manages a pool of worker threads (default: 4)
- Each worker has its own browser instance
- Queue system for handling concurrent requests
- Metrics tracking for monitoring

### Key Features

1. **Worker Pool Management**
   - Configurable pool size via `DEEP_WEB_WORKER_POOL_SIZE` environment variable
   - Automatic worker initialization
   - Queue system for requests when all workers are busy

2. **Parallel Execution**
   - Multiple endpoints processed simultaneously
   - Each endpoint uses a different worker thread
   - True parallel execution (not sequential)

3. **Metrics**
   - Total workers
   - Available workers
   - Active workers
   - Queued requests
   - Request statistics (total, completed, failed)

### Configuration

Add to your `.env` file:
```bash
# Number of worker threads in the pool (default: 4)
# Recommended: 2-8 depending on server CPU cores
DEEP_WEB_WORKER_POOL_SIZE=4
```

## Phase 3: Advanced Optimizations

### Architecture

**PersistentBrowserPool** (`src/lib/scrapers/PersistentBrowserPool.ts`)
- Extends `ScraperWorkerPool`
- Tracks endpoint performance
- Implements priority queue
- Provides enhanced metrics

**Redis Cache** (`src/lib/utils/redis-cache.ts`)
- Optional Redis caching for search results
- Falls back to in-memory cache if Redis unavailable
- 5-minute TTL for cached results

### Key Features

1. **Performance Tracking**
   - Tracks average response time per endpoint
   - Calculates success rates
   - Maintains performance history (24 hours)

2. **Priority Queue**
   - Automatically prioritizes fast sources
   - Fast sources processed first
   - Users see results progressively

3. **Caching**
   - Redis cache for search results (5 minutes)
   - In-memory fallback if Redis unavailable
   - Cache key includes reference and client type

4. **Persistent Pool**
   - Global pool instance reused across requests
   - Browsers stay alive between API calls
   - Contexts persist (from Phase 1)

### Configuration

Add to your `.env` file:
```bash
# Redis URL (optional - falls back to in-memory cache)
REDIS_URL="redis://localhost:6379"

# Worker pool size (default: 4)
DEEP_WEB_WORKER_POOL_SIZE=4
```

### Redis Setup (Optional)

If you want to use Redis for caching:

1. **Install Redis** (local development):
   ```bash
   # macOS
   brew install redis
   brew services start redis

   # Linux
   sudo apt-get install redis-server
   sudo systemctl start redis
   ```

2. **Install ioredis package**:
   ```bash
   npm install ioredis
   ```

3. **Configure Redis URL**:
   ```bash
   REDIS_URL="redis://localhost:6379"
   ```

4. **Production (Railway/Heroku)**:
   - Add Redis service in your platform
   - Set `REDIS_URL` environment variable
   - The system will automatically connect

**Note**: Redis is optional. If not configured, the system uses in-memory caching which works perfectly for single-instance deployments.

## Usage

The implementation is automatic. No code changes needed in your application code. The deep web search API route automatically:

1. Initializes the pool on first request
2. Uses parallel processing for all endpoints
3. Caches results automatically
4. Prioritizes fast sources
5. Tracks performance metrics

## Monitoring

### Metrics Available

The API response includes a `metrics` field with:

```typescript
{
  metrics: {
    totalWorkers: number;
    availableWorkers: number;
    activeWorkers: number;
    queuedRequests: number;
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    endpointPerformance: Array<{
      originCode: string;
      averageResponseTime: number;
      requestCount: number;
      successRate: number;
    }>;
    averageResponseTime: number;
  }
}
```

### Logging

The system logs:
- Pool initialization
- Worker assignment
- Cache hits/misses
- Performance metrics
- Priority order

## Performance Expectations

### Phase 2 (Parallel Processing)
- **Before**: ~81s (sequential)
- **After**: ~20s (4 workers, parallel)
- **Speedup**: 4x

### Phase 3 (Advanced)
- **First search**: ~18s (parallel + priority)
- **Cached search**: ~2s (instant from cache)
- **Different term**: ~8s (persisted login + parallel)
- **Speedup**: 4-40x depending on scenario

## Troubleshooting

### Pool Not Initializing
- Check `DEEP_WEB_WORKER_POOL_SIZE` is set correctly
- Verify worker thread compilation (`npm run build:worker`)
- Check server has enough CPU cores

### Redis Connection Issues
- System automatically falls back to in-memory cache
- Check `REDIS_URL` is correct
- Verify Redis server is running

### High Memory Usage
- Reduce `DEEP_WEB_WORKER_POOL_SIZE`
- Each worker uses ~150-200MB RAM
- Recommended: 2-4 workers for most servers

### Slow Performance
- Check pool metrics in API response
- Verify endpoints are being processed in parallel
- Check for queue buildup (indicates need for more workers)

## Best Practices

1. **Pool Size**: Set to number of CPU cores (or cores - 1)
2. **Redis**: Use for multi-instance deployments, optional for single instance
3. **Monitoring**: Track metrics to optimize pool size
4. **Cleanup**: Pool persists across requests (by design), closes on server shutdown

## Files Created/Modified

### New Files
- `src/lib/scrapers/ScraperWorkerPool.ts` - Worker pool implementation
- `src/lib/scrapers/PersistentBrowserPool.ts` - Enhanced pool with performance tracking
- `src/lib/utils/redis-cache.ts` - Redis caching utility

### Modified Files
- `src/app/api/search/deep-web/route.ts` - Updated to use pool and caching
- `package.json` - Added `ioredis` dependency

## Next Steps

1. Monitor performance in production
2. Adjust pool size based on server resources
3. Consider Redis for multi-instance deployments
4. Track metrics to identify slow endpoints
5. Optimize endpoint configurations based on performance data

