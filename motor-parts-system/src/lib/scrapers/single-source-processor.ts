/**
 * Single Source Processor
 * Handles processing one source at a time with browser context reuse for session persistence
 */

import { ScraperWorker } from './ScraperWorker';
import { ParserFactory } from '@/lib/parsers/ParserFactory';
import { prisma } from '@/lib/prisma';
import type { DeepWebEndpoint } from '@prisma/client';
import type { ParseResult, Product } from '@/lib/parsers/types';

// Browser context cache per origin (reuses sessions)
const contextCache = new Map<string, {
  scraper: ScraperWorker;
  lastUsed: number;
  isAuthenticated: boolean;
}>();

const CONTEXT_TTL = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Cleanup old contexts periodically
setInterval(() => {
  const now = Date.now();
  for (const [originCode, context] of Array.from(contextCache.entries())) {
    if (now - context.lastUsed > CONTEXT_TTL) {
      context.scraper.close().catch(console.error);
      contextCache.delete(originCode);
      console.log(`[SingleSourceProcessor] Cleaned up context for ${originCode}`);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Register parsers if not already registered
 */
async function registerParsers() {
  if (ParserFactory.getAllParsers().length === 0) {
    const [
      { PartequiposParser },
      { AgroCostaParser },
      { GecolsaParser },
      { ServitractorParser },
      { ImportadoraGranAndinaParser },
      { RetrotracParser }
    ] = await Promise.all([
      import('@/lib/parsers/PartequiposParser'),
      import('@/lib/parsers/AgroCostaParser'),
      import('@/lib/parsers/GecolsaParser'),
      import('@/lib/parsers/ServitractorParser'),
      import('@/lib/parsers/ImportadoraGranAndinaParser'),
      import('@/lib/parsers/RetrotracParser')
    ]);

    ParserFactory.registerParser(new PartequiposParser());
    ParserFactory.registerParser(new AgroCostaParser());
    ParserFactory.registerParser(new GecolsaParser());
    ParserFactory.registerParser(new ServitractorParser());
    ParserFactory.registerParser(new ImportadoraGranAndinaParser());
    ParserFactory.registerParser(new RetrotracParser());
  }
}

/**
 * Build URL with reference replacement
 */
function buildUrl(urlTemplate: string, reference: string, token?: string, tokenPlacement?: string): string {
  let url = urlTemplate;

  // Handle pageParameters in URL-encoded JSON
  if (url.includes('pageParameters=')) {
    const match = url.match(/pageParameters=([^&]+)/);
    if (match) {
      try {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.includes('{{reference}}')) {
          const withReference = decoded.replace(/\{\{reference\}\}/g, reference);
          const reencoded = encodeURIComponent(withReference);
          url = url.replace(/pageParameters=[^&]+/, `pageParameters=${reencoded}`);
        } else {
          url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
        }
      } catch (e) {
        url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
      }
    } else {
      url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
    }
  } else {
    url = url.replace(/\{\{reference\}\}/g, encodeURIComponent(reference));
  }

  if (token && tokenPlacement === 'query') {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}token=${encodeURIComponent(token)}`;
  }

  return url;
}

/**
 * Build request headers
 */
function buildHeaders(token?: string, tokenHeaderName?: string, tokenPlacement?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  if (token && tokenHeaderName && tokenPlacement === 'header') {
    headers[tokenHeaderName] = token;
  }

  return headers;
}

/**
 * Build request body for POST
 */
function buildBody(bodyTemplate: string | null, reference: string, token?: string, tokenPlacement?: string): string | undefined {
  if (!bodyTemplate) return undefined;

  let body = bodyTemplate.replace(/\{\{reference\}\}/g, reference);

  if (token && tokenPlacement === 'body') {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === 'object') {
        parsed.token = token;
        body = JSON.stringify(parsed);
      }
    } catch {
      body += `&token=${encodeURIComponent(token)}`;
    }
  }

  return body;
}

/**
 * Get or create browser context for an origin (reuses session)
 */
async function getOrCreateContext(originCode: string): Promise<ScraperWorker> {
  const cached = contextCache.get(originCode);
  
  if (cached && cached.isAuthenticated) {
    // Reuse existing authenticated context
    cached.lastUsed = Date.now();
    console.log(`[SingleSourceProcessor] Reusing authenticated context for ${originCode}`);
    return cached.scraper;
  }

  // Create new context
  const scraper = new ScraperWorker();
  await scraper.initialize();
  
  contextCache.set(originCode, {
    scraper,
    lastUsed: Date.now(),
    isAuthenticated: false,
  });

  console.log(`[SingleSourceProcessor] Created new context for ${originCode}`);
  return scraper;
}

/**
 * Mark context as authenticated
 */
function markContextAuthenticated(originCode: string) {
  const cached = contextCache.get(originCode);
  if (cached) {
    cached.isAuthenticated = true;
    cached.lastUsed = Date.now();
  }
}

/**
 * Process a single source endpoint
 */
export async function processSingleSource(
  originCode: string,
  reference: string
): Promise<{
  success: boolean;
  data?: {
    originCode: string;
    originName: string;
    searchTerm: string;
    products: Product[];
    metadata: any;
  };
  error?: string;
  metadata?: {
    searchDuration: number;
    timestamp: string;
  };
}> {
  const startTime = Date.now();

  try {
    // Register parsers
    await registerParsers();

    // Get endpoint from database
    const endpoint = await (prisma as any).deepWebEndpoint.findUnique({
      where: { originCode },
    }) as DeepWebEndpoint | null;

    if (!endpoint || !endpoint.isActive) {
      return {
        success: false,
        error: `Source ${originCode} not found or inactive`,
      };
    }

    // Get or create browser context (reuses authenticated sessions)
    const scraper = await getOrCreateContext(originCode);

    // Build request configuration
    const url = buildUrl(
      endpoint.url,
      reference,
      endpoint.token || undefined,
      endpoint.tokenPlacement
    );

    const headers = buildHeaders(
      endpoint.token || undefined,
      endpoint.tokenHeaderName || undefined,
      endpoint.tokenPlacement
    );

    const body = endpoint.method === 'POST' 
      ? buildBody(
          endpoint.requestBodyTemplate || null,
          reference,
          endpoint.token || undefined,
          endpoint.tokenPlacement
        )
      : undefined;

    // Set Content-Type for POST
    if (endpoint.method === 'POST' && body) {
      const contentType = (endpoint.parserConfig as any)?.contentType || 'application/json';
      headers['Content-Type'] = contentType;
    }

    // Get cookies from parserConfig or env
    let cookies: string | undefined = undefined;
    const parserConfigCookies = 
      endpoint.parserConfig && 
      typeof endpoint.parserConfig === 'object' && 
      'cookies' in endpoint.parserConfig 
        ? (endpoint.parserConfig as { cookies?: unknown }).cookies 
        : undefined;
    if (parserConfigCookies && typeof parserConfigCookies === 'string') {
      cookies = parserConfigCookies;
      headers['Cookie'] = cookies;
    } else {
      const envCookieName = `${endpoint.originCode}_COOKIES`;
      const envCookies = process.env[envCookieName];
      if (envCookies) {
        cookies = envCookies;
        headers['Cookie'] = cookies;
      }
    }

    // Check if we need to authenticate (and haven't already)
    const cached = contextCache.get(originCode);
    const needsLogin = endpoint.requiresLogin && (!cached?.isAuthenticated);

    if (needsLogin && endpoint.loginUrl) {
      console.log(`[SingleSourceProcessor] Authenticating ${originCode}...`);
      // Authentication will be handled by ScraperWorker if loginSteps are provided
      // or by the old login flow if loginSteps is null
    }

      // Log loginSteps configuration (combined login+search)
      if (endpoint.loginSteps) {
        const stepCount = Array.isArray(endpoint.loginSteps) ? endpoint.loginSteps.length : 0;
        console.log(`[SingleSourceProcessor] ${originCode} has ${stepCount} login steps configured (combined login+search)`);
      } else {
        console.log(`[SingleSourceProcessor] ${originCode} has no loginSteps, will use direct URL navigation`);
      }

      // Log timeout configuration
      console.log(`[SingleSourceProcessor] ${originCode} endpoint.timeoutMs: ${endpoint.timeoutMs}`);
      console.log(`[SingleSourceProcessor] ${originCode} passing timeout to scraper: ${endpoint.timeoutMs}`);

      // Scrape content
      const content = await scraper.scrape({
        url,
        method: endpoint.method,
        headers,
        body,
        timeout: endpoint.timeoutMs,
        waitForSelector: endpoint.waitForSelector || undefined,
        retryAttempts: endpoint.retryAttempts,
        requiresLogin: needsLogin,
        loginUrl: endpoint.loginUrl || undefined,
        loginUsername: endpoint.loginUsername || undefined,
        loginPassword: endpoint.loginPassword || undefined,
        loginFormSelector: endpoint.loginFormSelector || undefined,
        usernameField: endpoint.usernameField || undefined,
        passwordField: endpoint.passwordField || undefined,
        cookies,
        loginSteps: endpoint.loginSteps as any, // Pass combined login+search steps
        reference, // Pass reference for loginSteps {{reference}} placeholder replacement
      });

    // Mark as authenticated if login was performed
    if (needsLogin) {
      markContextAuthenticated(originCode);
    }

    // Parse content
    const parser = await ParserFactory.getParser(endpoint);
    
    // Prepare content for parsing
    let parsedContent: string | object = content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          parsedContent = JSON.parse(trimmed);
        } catch {
          parsedContent = content;
        }
      }
    }

    const result = await parser.parse(parsedContent, reference);

    const searchDuration = Date.now() - startTime;

    return {
      success: true,
      data: {
        originCode: result.originCode,
        originName: result.originName,
        searchTerm: reference,
        products: result.products,
        metadata: {
          ...result.metadata,
          searchDuration,
        },
      },
      metadata: {
        searchDuration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error(`[SingleSourceProcessor] Error processing ${originCode}:`, error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
      metadata: {
        searchDuration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Clean up all contexts (call on app shutdown)
 */
export async function cleanupAllContexts() {
  for (const [originCode, context] of Array.from(contextCache.entries())) {
    await context.scraper.close().catch(console.error);
    contextCache.delete(originCode);
  }
  console.log('[SingleSourceProcessor] All contexts cleaned up');
}

