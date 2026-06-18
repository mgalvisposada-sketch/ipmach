/**
 * Persistent Browser Pool - Keeps browsers and contexts alive between requests
 * Extends ScraperWorkerPool with persistent state management
 */

import { ScraperWorkerPool, type PoolMetrics } from './ScraperWorkerPool';
import type { ScrapeConfig } from './ScrapeConfig';

interface EndpointPerformance {
  originCode: string;
  averageResponseTime: number;
  requestCount: number;
  lastRequestTime: number;
  successRate: number;
  successCount: number;
  failureCount: number;
}

export class PersistentBrowserPool extends ScraperWorkerPool {
  private endpointPerformance = new Map<string, EndpointPerformance>();
  private performanceCleanupInterval: NodeJS.Timeout | null = null;
  private readonly PERFORMANCE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(poolSize?: number) {
    super(poolSize);
    // Cleanup old performance data every hour
    this.performanceCleanupInterval = setInterval(() => {
      this.cleanupPerformanceData();
    }, 60 * 60 * 1000);
  }

  /**
   * Scrape with performance tracking
   */
  async scrape(config: ScrapeConfig): Promise<string> {
    const startTime = Date.now();
    const originCode = config.originCode || 'unknown';

    try {
      const result = await super.scrape(config);
      const duration = Date.now() - startTime;

      // Update performance metrics
      this.updatePerformanceMetrics(originCode, duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Update performance metrics (failure)
      this.updatePerformanceMetrics(originCode, duration, false);

      throw error;
    }
  }

  /**
   * Update performance metrics for an endpoint
   */
  private updatePerformanceMetrics(
    originCode: string,
    duration: number,
    success: boolean
  ): void {
    const existing = this.endpointPerformance.get(originCode) || {
      originCode,
      averageResponseTime: duration,
      requestCount: 0,
      lastRequestTime: Date.now(),
      successRate: 1.0,
      successCount: 0,
      failureCount: 0,
    };

    existing.requestCount++;
    existing.lastRequestTime = Date.now();

    // Calculate moving average (exponential smoothing)
    const alpha = 0.3; // Smoothing factor
    existing.averageResponseTime =
      alpha * duration + (1 - alpha) * existing.averageResponseTime;

    if (success) {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }

    existing.successRate =
      existing.successCount / (existing.successCount + existing.failureCount);

    this.endpointPerformance.set(originCode, existing);
  }

  /**
   * Get endpoint performance data
   */
  getEndpointPerformance(originCode: string): EndpointPerformance | undefined {
    return this.endpointPerformance.get(originCode);
  }

  /**
   * Get all endpoint performance data sorted by average response time (fastest first)
   */
  getAllEndpointPerformance(): EndpointPerformance[] {
    return Array.from(this.endpointPerformance.values()).sort(
      (a, b) => a.averageResponseTime - b.averageResponseTime
    );
  }

  /**
   * Get priority order for endpoints (fastest first)
   */
  getPriorityOrder(originCodes: string[]): string[] {
    const performance = this.getAllEndpointPerformance();
    const performanceMap = new Map(
      performance.map((p) => [p.originCode, p.averageResponseTime])
    );

    // Sort by performance (fastest first), then by original order
    return originCodes.sort((a, b) => {
      const aTime = performanceMap.get(a) || 30000; // Default 30s if unknown
      const bTime = performanceMap.get(b) || 30000;
      return aTime - bTime;
    });
  }

  /**
   * Cleanup old performance data
   */
  private cleanupPerformanceData(): void {
    const now = Date.now();
    const entries = Array.from(this.endpointPerformance.entries());
    for (const [originCode, perf] of entries) {
      if (now - perf.lastRequestTime > this.PERFORMANCE_TTL) {
        this.endpointPerformance.delete(originCode);
        console.log(`[PersistentBrowserPool] Cleaned up performance data for ${originCode}`);
      }
    }
  }

  /**
   * Get enhanced metrics including performance data
   */
  getEnhancedMetrics(): PoolMetrics & {
    endpointPerformance: EndpointPerformance[];
    averageResponseTime: number;
  } {
    const baseMetrics = super.getMetrics();
    const allPerformance = this.getAllEndpointPerformance();

    const avgResponseTime =
      allPerformance.length > 0
        ? allPerformance.reduce((sum, p) => sum + p.averageResponseTime, 0) /
          allPerformance.length
        : 0;

    return {
      ...baseMetrics,
      endpointPerformance: allPerformance,
      averageResponseTime: avgResponseTime,
    };
  }

  /**
   * Close pool and cleanup
   */
  async close(): Promise<void> {
    if (this.performanceCleanupInterval) {
      clearInterval(this.performanceCleanupInterval);
      this.performanceCleanupInterval = null;
    }
    this.endpointPerformance.clear();
    await super.close();
  }
}

