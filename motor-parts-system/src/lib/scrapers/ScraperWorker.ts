/**
 * Wrapper for Playwright scraper using Worker Threads
 * This isolates Playwright from the main Next.js bundle
 */

// Dynamic imports to avoid build-time issues
// Only import types, not actual modules
import type { ScrapeConfig } from './ScrapeConfig';
import type {
  ScrapeRequest,
  ScrapeResponse,
  InitRequest,
  InitResponse,
  CloseRequest,
  CloseResponse,
  WorkerResponse,
} from '../workers/worker-messages';

export class ScraperWorker {
  private worker: any = null; // Use any to avoid type import issues
  private isInitialized = false;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

  /**
   * Initialize the worker thread
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.worker) {
      return;
    }

    try {
      // Dynamic import of Node.js modules
      const workerThreads = await import('worker_threads');
      const path = await import('path');
      const Worker = workerThreads.Worker;
      const join = path.join;

      // Create worker thread
      // IMPORTANT: Worker must be compiled JavaScript, not TypeScript
      // Next.js will compile it during build, but we need to ensure it's available
      const fs = await import('fs');
      const isProduction = process.env.NODE_ENV === 'production';
      const cwd = process.cwd();

      // Try multiple possible paths for the compiled worker
      // Priority order: most likely paths first
      const possiblePaths = [
        // Primary: Copied to /app/lib/workers/playwright-worker.js in Docker (production)
        join(cwd, 'lib', 'workers', 'playwright-worker.js'),
        // Absolute path fallback (for Docker/Railway when cwd might be different)
        '/app/lib/workers/playwright-worker.js',
        // Development: Compiled by build:worker script
        join(cwd, 'lib', 'workers', 'playwright-worker.js'),
        // Next.js standalone output (if it includes lib)
        join(cwd, '.next', 'standalone', 'lib', 'workers', 'playwright-worker.js'),
        // Next.js server output
        join(cwd, '.next', 'server', 'lib', 'workers', 'playwright-worker.js'),
        // Alternative: Next.js build output
        join(cwd, '.next', 'server', 'chunks', 'lib', 'workers', 'playwright-worker.js'),
      ];

      let resolvedPath: string | null = null;

      // Debug: Log search attempt
      console.log(`[ScraperWorker] Searching for worker in cwd: ${cwd}`);

      for (const possiblePath of possiblePaths) {
        try {
          // Use fs.existsSync for more reliable path checking
          if (fs.existsSync(possiblePath)) {
            // Also verify it's actually a file
            const stats = fs.statSync(possiblePath);
            if (stats.isFile()) {
              resolvedPath = possiblePath;
              console.log(`[ScraperWorker] Found worker at: ${resolvedPath}`);
              break;
            }
          }
        } catch (error: any) {
          // Continue to next path
          console.debug(`[ScraperWorker] Path not found: ${possiblePath} (${error.message})`);
        }
      }

      if (!resolvedPath) {
        // Build detailed error message with all attempted paths
        const triedPaths = possiblePaths.map(p => {
          try {
            const exists = fs.existsSync(p);
            const isDir = exists ? fs.statSync(p).isDirectory() : false;
            return `  - ${p} ${exists ? (isDir ? '(exists but is directory)' : '(exists)') : '(not found)'}`;
          } catch (error: any) {
            return `  - ${p} (error: ${error.message})`;
          }
        });

        // Also list what's actually in lib/workers if it exists
        const libWorkersPath = join(cwd, 'lib', 'workers');
        let libContents = '';
        try {
          if (fs.existsSync(libWorkersPath)) {
            const contents = fs.readdirSync(libWorkersPath);
            libContents = `\nContents of ${libWorkersPath}:\n  ${contents.join('\n  ')}`;
          } else {
            libContents = `\nDirectory ${libWorkersPath} does not exist.`;
          }
        } catch (error: any) {
          libContents = `\nError reading ${libWorkersPath}: ${error.message}`;
        }

        throw new Error(
          'Worker thread not found. Please run "npm run build:worker" first.\n' +
          'The worker must be compiled to JavaScript before it can be used.\n' +
          `Current working directory: ${cwd}\n` +
          'Tried paths:\n' + triedPaths.join('\n') +
          libContents
        );
      }

      // Create worker without any special loaders (it's already compiled JS)
      this.worker = new Worker(resolvedPath);

      // Handle messages from worker
      this.worker.on('message', (response: WorkerResponse) => {
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.success) {
            pending.resolve(response);
          } else {
            pending.reject(new Error(response.error || 'Unknown error'));
          }
        }
      });

      // Handle worker errors
      this.worker.on('error', (error: Error) => {
        console.error('[ScraperWorker] Worker error:', error);
        // Reject all pending requests
        for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
          this.pendingRequests.delete(id);
          pending.reject(error);
        }
      });

      // Handle worker exit
      this.worker.on('exit', (code: number) => {
        if (code !== 0) {
          console.error(`[ScraperWorker] Worker stopped with exit code ${code}`);
          console.error(`[ScraperWorker] This usually indicates an uncaught error in the worker thread.`);
          console.error(`[ScraperWorker] Check the logs above for uncaught exceptions or unhandled rejections.`);

          // Reject all pending requests with a descriptive error
          for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
            this.pendingRequests.delete(id);
            pending.reject(new Error(`Worker thread exited with code ${code}. This usually indicates an uncaught error. Check worker logs for details.`));
          }
        } else {
          console.log('[ScraperWorker] Worker exited normally');
        }
        this.worker = null;
        this.isInitialized = false;
      });

      // Initialize browser in worker
      const initRequest: InitRequest = {
        id: this.generateId(),
        type: 'init',
      };

      await this.sendRequest(initRequest);
      this.isInitialized = true;
    } catch (error) {
      console.error('[ScraperWorker] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Scrape content from an endpoint
   */
  async scrape(config: ScrapeConfig): Promise<string> {
    if (!this.isInitialized || !this.worker) {
      await this.initialize();
    }

    console.log(`[ScraperWorker] scrape() received config.timeout: ${config.timeout}`);

    const request: ScrapeRequest = {
      id: this.generateId(),
      type: 'scrape',
      config: {
        url: config.url,
        method: config.method || 'GET',
        headers: config.headers,
        body: config.body,
        timeout: config.timeout,
        waitForSelector: config.waitForSelector,
        retryAttempts: config.retryAttempts,
        requiresLogin: config.requiresLogin,
        loginUrl: config.loginUrl,
        loginUsername: config.loginUsername,
        loginPassword: config.loginPassword,
        loginFormSelector: config.loginFormSelector,
        usernameField: config.usernameField,
        passwordField: config.passwordField,
        cookies: config.cookies,
        originCode: config.originCode,
        loginSteps: config.loginSteps, // Combined login+search steps
        reference: config.reference,
      },
    };

    const response = await this.sendRequest<ScrapeResponse>(request);

    if (!response.success) {
      throw new Error(response.error || 'Scraping failed');
    }

    return response.content || '';
  }

  /**
   * Send request to worker and wait for response
   */
  private sendRequest<T extends WorkerResponse>(request: ScrapeRequest | InitRequest | CloseRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.pendingRequests.set(request.id, { resolve, reject });

      // Set timeout - use config timeout if available, otherwise default to 2 minutes
      // For deep web with login + search, we need more time
      const configTimeout = (request as any).config?.timeout;
      let finalTimeout = 120000; // Default 2 minutes

      console.log(`[ScraperWorker] Request config timeout: ${configTimeout || 'undefined'}`);

      if (configTimeout) {
        // If config has timeout, use it with 30s buffer
        finalTimeout = configTimeout + 30000;
        console.log(`[ScraperWorker] Using config timeout ${configTimeout}ms + 30s buffer = ${finalTimeout}ms`);
      } else {
        console.log(`[ScraperWorker] No config timeout, using default ${finalTimeout}ms`);
      }

      console.log(`[ScraperWorker] Final request timeout set to: ${finalTimeout}ms`);

      setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error('Request timeout'));
        }
      }, finalTimeout); // Dynamic timeout based on config

      this.worker.postMessage(request);
    });
  }

  /**
   * Close the worker thread
   */
  async close(): Promise<void> {
    if (this.worker) {
      try {
        const request: CloseRequest = {
          id: this.generateId(),
          type: 'close',
        };
        await this.sendRequest<CloseResponse>(request);
      } catch (error) {
        console.error('[ScraperWorker] Error closing worker:', error);
      }

      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if worker is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

