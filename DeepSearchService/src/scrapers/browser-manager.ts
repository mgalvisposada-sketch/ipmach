/**
 * Browser and session management
 * Handles browser instances and session persistence
 * Uses browser contexts for better isolation between sources
 */

import puppeteer, { Browser, BrowserContext, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

interface SessionCache {
  [originCode: string]: {
    browser: Browser;
    context: BrowserContext;
    lastUsed: number;
    storageStatePath: string;
  };
}

const sessionCache: SessionCache = {};
const SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSIONS_DIR = path.join(process.cwd(), '.puppeteer-sessions');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

/**
 * Get storage state file path for an origin
 */
export function getStorageStatePath(originCode: string): string {
  return path.join(SESSIONS_DIR, `${originCode.toLowerCase()}-session.json`);
}

/**
 * Check if storage state file exists and is valid
 */
export function hasValidStorageState(originCode: string): boolean {
  const storageStatePath = getStorageStatePath(originCode);
  if (!fs.existsSync(storageStatePath)) {
    return false;
  }

  try {
    const stats = fs.statSync(storageStatePath);
    const age = Date.now() - stats.mtimeMs;
    return age < SESSION_EXPIRY_MS;
  } catch {
    return false;
  }
}

/**
 * Launch browser with optimal settings
 * @param headless - Whether to run in headless mode
 * @param handlerOptions - Optional handler-specific browser options
 */
async function launchBrowser(headless: boolean = true, handlerOptions?: any): Promise<Browser> {
  const defaultArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--disable-gpu',
    '--disable-features=TranslateUI',
  ];

  // Merge handler-specific args with defaults
  const args = handlerOptions?.args 
    ? [...defaultArgs, ...handlerOptions.args]
    : defaultArgs;

  const launchOptions: any = {
    headless: headless ? true : false,
    args,
    ignoreHTTPSErrors: handlerOptions?.ignoreHTTPSErrors ?? false,
  };

  return await puppeteer.launch(launchOptions);
}

/**
 * Get or create browser instance for an origin
 * Uses handler-specific browser options if available
 */
export async function getOrCreateBrowser(originCode: string): Promise<Browser> {
  const cached = sessionCache[originCode];
  
  // Check if cached browser is still valid
  if (cached && Date.now() - cached.lastUsed < SESSION_EXPIRY_MS) {
    cached.lastUsed = Date.now();
    return cached.browser;
  }

  // Close old browser if exists
  if (cached?.browser) {
    try {
      await cached.browser.close();
    } catch (e) {
      console.warn(`[BrowserManager] Error closing old browser for ${originCode}:`, e);
    }
  }

  // Get handler-specific browser options if available
  const { SourceHandlerFactory } = await import('./handlers/SourceHandlerFactory');
  const handler = SourceHandlerFactory.getHandler(originCode);
  const handlerOptions = handler.getBrowserOptions?.();
  
  // Create new browser with handler-specific options or defaults
  const headless = handlerOptions?.headless !== undefined 
    ? handlerOptions.headless 
    : process.env.PUPPETEER_HEADLESS !== 'false';
  
  const browser = await launchBrowser(headless, handlerOptions);
  
  // Create a browser context for this origin (better isolation)
  const context = await browser.createBrowserContext();
  
  sessionCache[originCode] = {
    browser,
    context,
    lastUsed: Date.now(),
    storageStatePath: getStorageStatePath(originCode),
  };

  return browser;
}

/**
 * Get or create browser context for an origin
 * Uses cached context if available, creates new one if needed
 */
export async function getOrCreateContext(browser: Browser, originCode: string): Promise<BrowserContext> {
  const cached = sessionCache[originCode];
  
  // Check if cached context is still valid
  if (cached && cached.context && Date.now() - cached.lastUsed < SESSION_EXPIRY_MS) {
    cached.lastUsed = Date.now();
    return cached.context;
  }

  // Create new context
  const context = await browser.createBrowserContext();
  
  // Update cache if browser exists
  if (cached) {
    // Close old context if exists
    if (cached.context) {
      try {
        await cached.context.close();
      } catch (e) {
        console.warn(`[BrowserManager] Error closing old context for ${originCode}:`, e);
      }
    }
    cached.context = context;
    cached.lastUsed = Date.now();
  } else {
    // This shouldn't happen, but handle it gracefully
    console.warn(`[BrowserManager] No browser cache found for ${originCode}, creating new context`);
  }

  return context;
}

/**
 * Load session state (cookies) for a page
 */
export async function loadSessionState(page: Page, originCode: string): Promise<void> {
  const storageStatePath = getStorageStatePath(originCode);
  if (hasValidStorageState(originCode) && fs.existsSync(storageStatePath)) {
    const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
    await page.setCookie(...storageState.cookies || []);
    console.log(`[BrowserManager] Loaded session from ${storageStatePath}`);
  }
}

/**
 * Save session state (cookies) for a page
 */
export async function saveSessionState(page: Page, originCode: string): Promise<void> {
  const storageStatePath = getStorageStatePath(originCode);
  const cookies = await page.cookies();
  const storageState = { cookies };
  fs.writeFileSync(storageStatePath, JSON.stringify(storageState, null, 2));
  console.log(`[BrowserManager] Saved session state for ${originCode}`);
}

/**
 * Cleanup expired sessions
 */
export async function cleanupSessions(): Promise<void> {
  const now = Date.now();
  for (const [originCode, cache] of Object.entries(sessionCache)) {
    if (now - cache.lastUsed > SESSION_EXPIRY_MS) {
      try {
        // Close context first
        if (cache.context) {
          await cache.context.close();
        }
        // Then close browser
        await cache.browser.close();
        delete sessionCache[originCode];
        console.log(`[BrowserManager] Cleaned up expired session for ${originCode}`);
      } catch (e) {
        console.warn(`[BrowserManager] Error cleaning up ${originCode}:`, e);
      }
    }
  }
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  for (const cache of Object.values(sessionCache)) {
    try {
      if (cache.context) {
        await cache.context.close();
      }
      await cache.browser.close();
    } catch (e) {
      // Ignore
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  for (const cache of Object.values(sessionCache)) {
    try {
      if (cache.context) {
        await cache.context.close();
      }
      await cache.browser.close();
    } catch (e) {
      // Ignore
    }
  }
  process.exit(0);
});

