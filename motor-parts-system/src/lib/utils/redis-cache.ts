/**
 * Redis cache utility for deep web search results
 * Falls back to in-memory cache if Redis is not available
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

let redisClient: any = null;
let inMemoryCache: InMemoryCache | null = null;
let useRedis = false;

/**
 * Initialize Redis client (optional, falls back to in-memory cache)
 */
export async function initializeCache(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Try to import and use Redis (optional dependency)
      // Use dynamic import with error handling to avoid build-time errors
      // Next.js will still try to analyze this, so we need to handle it gracefully
      const redisModule = 'ioredis';
      let redis: any;
      
      try {
        // Dynamic import that Next.js won't analyze at build time
        redis = await import(/* webpackIgnore: true */ redisModule);
      } catch (importError: any) {
        // ioredis not installed or import failed, fall back to in-memory cache
        if (importError.code === 'MODULE_NOT_FOUND' || importError.message?.includes('Cannot find module')) {
          console.warn('[RedisCache] ⚠️ ioredis package not installed, using in-memory cache');
          console.warn('[RedisCache] To use Redis, run: npm install ioredis');
        } else {
          console.warn('[RedisCache] ⚠️ Failed to import ioredis:', importError.message);
        }
        useRedis = false;
        inMemoryCache = new InMemoryCache();
        return;
      }

      if (!redis || !redis.default) {
        throw new Error('ioredis module not properly loaded');
      }

      redisClient = new redis.default(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
      });

      await redisClient.connect();
      useRedis = true;
      console.log('[RedisCache] ✅ Connected to Redis');
    } catch (error: any) {
      console.warn('[RedisCache] ⚠️ Redis connection failed, using in-memory cache:', error.message);
      useRedis = false;
      inMemoryCache = new InMemoryCache();
    }
  } else {
    console.log('[RedisCache] No REDIS_URL configured, using in-memory cache');
    useRedis = false;
    inMemoryCache = new InMemoryCache();
  }
}

/**
 * Get cached value
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    if (useRedis && redisClient) {
      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } else if (inMemoryCache) {
      return await inMemoryCache.get<T>(key);
    }
    return null;
  } catch (error: any) {
    console.error('[RedisCache] Error getting cache:', error.message);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCached<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } else if (inMemoryCache) {
      await inMemoryCache.set(key, value, ttlSeconds);
    }
  } catch (error: any) {
    console.error('[RedisCache] Error setting cache:', error.message);
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    if (useRedis && redisClient) {
      await redisClient.del(key);
    } else if (inMemoryCache) {
      await inMemoryCache.delete(key);
    }
  } catch (error: any) {
    console.error('[RedisCache] Error deleting cache:', error.message);
  }
}

/**
 * Generate cache key for deep web search
 */
export function getDeepWebCacheKey(reference: string, clientType?: number): string {
  return `deep-web-search:${reference}:${clientType || 'default'}`;
}

/**
 * Close cache connections
 */
export async function closeCache(): Promise<void> {
  try {
    if (useRedis && redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
    if (inMemoryCache) {
      inMemoryCache.destroy();
      inMemoryCache = null;
    }
  } catch (error: any) {
    console.error('[RedisCache] Error closing cache:', error.message);
  }
}

