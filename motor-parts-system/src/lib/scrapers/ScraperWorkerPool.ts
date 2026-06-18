/**
 * Worker Pool for managing multiple Playwright scraper workers
 * Enables parallel processing of multiple endpoints simultaneously
 */

import { ScraperWorker } from './ScraperWorker';
import type { ScrapeConfig } from './ScrapeConfig';

export interface PoolMetrics {
  totalWorkers: number;
  availableWorkers: number;
  activeWorkers: number;
  queuedRequests: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
}

export class ScraperWorkerPool {
  private workers: ScraperWorker[] = [];
  private available: ScraperWorker[] = [];
  private queue: Array<{
    config: ScrapeConfig;
    resolve: (value: string) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = [];
  private activeRequests = new Map<string, { worker: ScraperWorker; startTime: number }>();
  private metrics = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
  };

  constructor(
    private poolSize: number = parseInt(process.env.DEEP_WEB_WORKER_POOL_SIZE || '4', 10)
  ) {
    if (this.poolSize < 1) {
      this.poolSize = 1;
    }
    if (this.poolSize > 8) {
      console.warn(`[ScraperWorkerPool] Pool size ${this.poolSize} is large, consider reducing for better resource management`);
      this.poolSize = 8;
    }
    console.log(`[ScraperWorkerPool] Initializing pool with ${this.poolSize} workers`);
  }

  /**
   * Initialize all workers in the pool
   */
  async initialize(): Promise<void> {
    console.log(`[ScraperWorkerPool] Initializing ${this.poolSize} workers...`);
    const initPromises: Promise<void>[] = [];

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new ScraperWorker();
      this.workers.push(worker);
      this.available.push(worker);
      initPromises.push(worker.initialize().catch((error) => {
        console.error(`[ScraperWorkerPool] Failed to initialize worker ${i}:`, error);
        throw error;
      }));
    }

    await Promise.all(initPromises);
    console.log(`[ScraperWorkerPool] ✅ All ${this.poolSize} workers initialized successfully`);
  }

  /**
   * Scrape content using an available worker from the pool
   */
  async scrape(config: ScrapeConfig): Promise<string> {
    this.metrics.totalRequests++;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const requestId = `${config.originCode || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // If we have an available worker, use it immediately
      if (this.available.length > 0) {
        const worker = this.available.pop()!;
        this.executeScrape(worker, config, resolve, reject, requestId, startTime);
      } else {
        // Queue the request
        console.log(`[ScraperWorkerPool] No available workers, queuing request (queue size: ${this.queue.length + 1})`);
        this.queue.push({
          config,
          resolve,
          reject,
          startTime,
        });
      }
    });
  }

  /**
   * Execute scrape on a worker
   */
  private async executeScrape(
    worker: ScraperWorker,
    config: ScrapeConfig,
    resolve: (value: string) => void,
    reject: (error: Error) => void,
    requestId: string,
    startTime: number
  ): Promise<void> {
    // Mark worker as active
    this.activeRequests.set(requestId, { worker, startTime });
    const originCode = config.originCode || 'unknown';

    console.log(`[ScraperWorkerPool] Worker assigned to ${originCode} (active: ${this.activeRequests.size}, available: ${this.available.length}, queued: ${this.queue.length})`);

    try {
      const result = await worker.scrape(config);
      const duration = Date.now() - startTime;
      this.metrics.completedRequests++;
      console.log(`[ScraperWorkerPool] ✅ ${originCode} completed in ${duration}ms`);
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedRequests++;
      console.error(`[ScraperWorkerPool] ❌ ${originCode} failed after ${duration}ms:`, (error as Error).message);
      reject(error as Error);
    } finally {
      // Remove from active requests
      this.activeRequests.delete(requestId);

      // Return worker to pool
      this.available.push(worker);
      console.log(`[ScraperWorkerPool] Worker returned to pool (available: ${this.available.length}, queued: ${this.queue.length})`);

      // Process next queued request if any
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        const nextRequestId = `${next.config.originCode || 'unknown'}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log(`[ScraperWorkerPool] Processing queued request for ${next.config.originCode || 'unknown'}`);
        this.executeScrape(worker, next.config, next.resolve, next.reject, nextRequestId, next.startTime);
      }
    }
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.available.length,
      activeWorkers: this.activeRequests.size,
      queuedRequests: this.queue.length,
      totalRequests: this.metrics.totalRequests,
      completedRequests: this.metrics.completedRequests,
      failedRequests: this.metrics.failedRequests,
    };
  }

  /**
   * Check if pool is ready
   */
  isReady(): boolean {
    return this.workers.length > 0 && this.workers.every(w => w.isReady());
  }

  /**
   * Close all workers in the pool
   */
  async close(): Promise<void> {
    console.log(`[ScraperWorkerPool] Closing pool with ${this.workers.length} workers...`);

    // Reject all queued requests
    for (const queued of this.queue) {
      queued.reject(new Error('Pool is closing'));
    }
    this.queue = [];

    // Close all workers
    const closePromises = this.workers.map((worker, index) =>
      worker.close().catch((error) => {
        console.error(`[ScraperWorkerPool] Error closing worker ${index}:`, error);
      })
    );

    await Promise.all(closePromises);
    this.workers = [];
    this.available = [];
    this.activeRequests.clear();

    console.log('[ScraperWorkerPool] ✅ Pool closed successfully');
  }
}

