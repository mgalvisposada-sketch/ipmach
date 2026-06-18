// Dynamic import for playwright to avoid build-time issues
// DO NOT import playwright types directly - use local type definitions
import { ScrapeConfig } from './ScrapeConfig';

// Local type definitions to avoid importing from playwright at build time
// These types will be resolved at runtime when playwright is dynamically imported
type Browser = {
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
  [key: string]: any;
};

type Page = {
  goto: (url: string, options?: any) => Promise<any>;
  content: () => Promise<string>;
  evaluate: (fn: any, ...args: any[]) => Promise<any>;
  waitForSelector: (selector: string, options?: any) => Promise<any>;
  click: (selector: string, options?: any) => Promise<void>;
  fill: (selector: string, value: string) => Promise<void>;
  waitForNavigation: (options?: any) => Promise<any>;
  cookies: () => Promise<any[]>;
  setCookie: (...cookies: any[]) => Promise<void>;
  close: () => Promise<void>;
  on: (event: string, handler: (download: any) => void) => void;
  [key: string]: any;
};

/**
 * Playwright-based scraper for fetching HTML/JSON content from external endpoints
 * Handles JavaScript-rendered content, authentication, and dynamic elements
 */
export class PlaywrightScraper {
  private browser: Browser | null = null;
  private isInitialized = false;

  /**
   * Initialize the browser instance (singleton pattern)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    // Dynamic import to avoid build-time execution
    // @ts-ignore - playwright is installed at runtime, not needed at build time
    const { chromium } = await import('playwright');

    this.browser = (await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })) as unknown as Browser;

    this.isInitialized = true;
  }

  /**
   * Perform login if required
   */
  private async performLogin(
    page: Page,
    loginUrl: string,
    username: string,
    password: string,
    formSelector?: string,
    usernameField?: string,
    passwordField?: string,
    timeout: number = 40000
  ): Promise<void> {
    await page.goto(loginUrl, {
      waitUntil: 'networkidle',
      timeout,
    });

    // Wait for login form
    const formSel = formSelector || 'form';
    await page.waitForSelector(formSel, { timeout });

    // Fill in username
    const userField = usernameField || 'input[name="usuario"], input[name="username"], input[type="text"]';
    await page.fill(userField, username);

    // Fill in password
    const passField = passwordField || 'input[name="contraseña"], input[name="password"], input[type="password"]';
    await page.fill(passField, password);

    // Submit form
    await page.click('button[type="submit"], input[type="submit"]');

    // Wait for navigation after login
    await page.waitForLoadState('networkidle', { timeout });

    // Small delay to ensure cookies are set
    await page.waitForTimeout(1000);
  }

  /**
   * Parse cookies from cookie string (e.g., "PHPSESSID=abc123; other=value")
   * Also extracts domain from URL if provided
   * Handles __Secure- and __Host- prefixed cookies correctly
   */
  private parseCookies(cookieString?: string, url?: string): Array<{ name: string; value: string; domain?: string; path: string; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' }> {
    if (!cookieString) return [];

    // Extract domain from URL if provided
    let domain: string | undefined;
    let isSecure = false;
    if (url) {
      try {
        const urlObj = new URL(url);
        domain = urlObj.hostname;
        isSecure = urlObj.protocol === 'https:';
        // Remove leading dot if present (some cookies use .domain.com format)
        if (domain.startsWith('.')) {
          domain = domain.substring(1);
        }
      } catch (e) {
        console.warn('⚠️ [PlaywrightScraper] Failed to parse URL for cookie domain:', e);
      }
    }

    const cookies: Array<{ name: string; value: string; domain?: string; path: string; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' }> = [];

    cookieString.split(';').forEach((cookie) => {
      const trimmed = cookie.trim();
      if (!trimmed) return;

      // Split on first '=' only (value might contain '=')
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        console.warn('⚠️ [PlaywrightScraper] Skipping invalid cookie (no =):', trimmed.substring(0, 50));
        return;
      }

      const name = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      // Validate cookie name
      if (!name || name.length === 0) {
        console.warn('⚠️ [PlaywrightScraper] Skipping cookie with empty name');
        return;
      }

      // Check for special cookie prefixes
      const isSecurePrefix = name.startsWith('__Secure-');
      const isHostPrefix = name.startsWith('__Host-');

      // Cookies with __Secure- or __Host- prefix require secure: true
      const requiresSecure = isSecurePrefix || isHostPrefix;
      // Cookies with __Host- prefix also require path: '/' and no domain
      const isHostCookie = isHostPrefix;

      const cookieObj: { name: string; value: string; domain?: string; path: string; secure?: boolean; sameSite?: 'Strict' | 'Lax' | 'None' } = {
        name,
        value: value || '',
        path: '/',
      };

      // Set domain (unless it's a __Host- cookie)
      if (domain && !isHostCookie) {
        cookieObj.domain = domain;
      }

      // Set secure flag for secure cookies or if URL is HTTPS
      if (requiresSecure || isSecure) {
        cookieObj.secure = true;
      }

      // Set sameSite for secure cookies (usually Lax)
      if (requiresSecure) {
        cookieObj.sameSite = 'Lax';
      }

      cookies.push(cookieObj);
    });

    console.log('🍪 [PlaywrightScraper] Parsed', cookies.length, 'cookies from cookie string');

    return cookies.filter(c => c.name && c.value !== undefined);
  }

  /**
   * Scrape content from an endpoint using Playwright
   * @param config - Scraping configuration
   * @returns HTML or JSON content as string
   */
  async scrape(config: ScrapeConfig): Promise<string> {
    if (!this.browser || !this.isInitialized) {
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Failed to initialize Playwright browser');
    }

    const page = await this.browser.newPage();

    try {
      // Note: Cookies are already set via Cookie header in config.headers
      // Playwright's addCookies() has strict requirements and often fails
      // Using Cookie header is more reliable for authentication cookies
      if (config.cookies) {
        const cookieCount = config.cookies.split(';').filter(c => c.trim()).length;
        console.log('🍪 [PlaywrightScraper] Cookies provided (', cookieCount, 'cookies). Using Cookie header (already set in headers)');

        // Try to add cookies via Playwright's addCookies for session management
        // But don't fail if it doesn't work - Cookie header will handle it
        try {
          const cookies = this.parseCookies(config.cookies, config.url);
          if (cookies.length > 0 && config.url) {
            // Navigate to domain first to establish context
            const urlObj = new URL(config.url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });

            // Filter out cookies that require special handling and might fail
            const safeCookies = cookies.filter(c => {
              // Skip __Secure- and __Host- cookies as they're tricky
              if (c.name.startsWith('__Secure-') || c.name.startsWith('__Host-')) {
                return false;
              }
              return true;
            });

            if (safeCookies.length > 0) {
              await page.context().addCookies(safeCookies);
              console.log('✅ [PlaywrightScraper] Added', safeCookies.length, 'cookies via addCookies (Cookie header also active)');
            }
          }
        } catch (cookieError: any) {
          // Silent fail - Cookie header will work
          console.log('ℹ️ [PlaywrightScraper] Using Cookie header only (addCookies not needed)');
        }
      }

      // Perform login if required
      if (config.requiresLogin && config.loginUrl && config.loginUsername && config.loginPassword) {
        try {
          await this.performLogin(
            page,
            config.loginUrl,
            config.loginUsername,
            config.loginPassword,
            config.loginFormSelector,
            config.usernameField,
            config.passwordField,
            config.timeout
          );
        } catch (error: any) {
          console.warn(`Login failed for ${config.loginUrl}: ${error.message}`);
          // Continue anyway - might already be logged in
        }
      }

      // Set headers if provided
      if (config.headers) {
        await page.setExtraHTTPHeaders(config.headers);
      }

      // Navigate or POST based on method
      if (config.method === 'GET') {
        // Check if URL might return JSON (common indicators like LoadIn=html, api, json, report, admin-ajax)
        const mightReturnJson = config.url.includes('LoadIn=html') ||
          config.url.includes('LoadIn=json') ||
          config.url.includes('/api/') ||
          config.url.includes('format=json') ||
          config.url.includes('/report/') ||
          config.url.includes('admin-ajax.php');

        // For JSON endpoints, use fetch API instead of page.goto to avoid download issues
        // This is critical for Servitractor which returns JSON but triggers downloads with page.goto
        if (mightReturnJson) {
          console.log('📥 [PlaywrightScraper] Detected JSON endpoint, using fetch API to avoid download');
          try {
            // First navigate to the base domain to establish context (needed for cookies/headers)
            const urlObj = new URL(config.url);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

            // Navigate to base URL first (without waiting for networkidle)
            await page.goto(baseUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 10000
            }).catch(() => {
              // Ignore errors - we just need the context
              console.log('ℹ️ [PlaywrightScraper] Base URL navigation optional');
            });

            // Now use fetch to get the JSON response
            const responseText = await page.evaluate(
              async ({ url, headers, timeout }: { url: string; headers?: Record<string, string>; timeout: number }) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                  const fetchHeaders = new Headers();

                  // Copy all headers
                  if (headers) {
                    Object.entries(headers).forEach(([key, value]) => {
                      fetchHeaders.append(key, String(value));
                    });
                  }

                  const response = await fetch(url, {
                    method: 'GET',
                    headers: fetchHeaders,
                    credentials: 'include', // Include cookies
                    signal: controller.signal,
                  });

                  if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                  }

                  clearTimeout(timeoutId);
                  const text = await response.text();
                  return text;
                } catch (error: any) {
                  clearTimeout(timeoutId);
                  throw new Error(error.message || 'Fetch failed');
                }
              },
              {
                url: config.url,
                headers: config.headers,
                timeout: config.timeout,
              }
            );

            console.log('✅ [PlaywrightScraper] Fetch successful, response length:', responseText.length);

            // Return the response text directly
            return responseText;
          } catch (fetchError: any) {
            console.warn('⚠️ [PlaywrightScraper] Fetch failed, falling back to page.goto:', fetchError.message);
            // Fall through to page.goto as fallback
          }
        }

        // Standard navigation for HTML pages
        // Handle download events gracefully
        const downloadPromise = new Promise<void>((resolve) => {
          page.on('download', (download: { url: () => string; cancel: () => Promise<void> }) => {
            console.warn('⚠️ [PlaywrightScraper] Download detected:', download.url());
            // Cancel the download or just ignore it
            download.cancel().catch(() => { });
            resolve();
          });
        });

        try {
          await Promise.race([
            page.goto(config.url, {
              waitUntil: 'networkidle',
              timeout: config.timeout,
            }),
            downloadPromise,
          ]);
        } catch (error: any) {
          // If it's a download error, try to get the content anyway
          if (error.message.includes('Download is starting')) {
            console.warn('⚠️ [PlaywrightScraper] Download detected, trying to get page content anyway');
            // Wait a bit for content to load
            await page.waitForTimeout(2000);
          } else {
            throw error;
          }
        }
      } else {
        // For POST requests, navigate to URL and submit form if needed, or use fetch
        // If body is provided, use fetch (for JSON or form data)
        // If no body, navigate directly (cookies will be preserved)
        if (config.body) {
          // POST with body - use fetch
          const responseText = await page.evaluate(
            async ({ url, headers, body, timeout }: { url: string; headers?: Record<string, string>; body: string; timeout: number }) => {
              const fetchOptions: RequestInit = {
                method: 'POST',
                headers: headers || {},
                credentials: 'include', // Include cookies
              };

              if (body) {
                fetchOptions.body = body;
                // Auto-detect content type if not specified
                if (!headers?.['Content-Type'] && !headers?.['content-type']) {
                  // Try to determine if body is JSON
                  try {
                    JSON.parse(body);
                    fetchOptions.headers = {
                      ...fetchOptions.headers,
                      'Content-Type': 'application/json',
                    };
                  } catch {
                    // Not JSON, default to form-urlencoded
                    fetchOptions.headers = {
                      ...fetchOptions.headers,
                      'Content-Type': 'application/x-www-form-urlencoded',
                    };
                  }
                }
              }

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), timeout);

              try {
                const response = await fetch(url, {
                  ...fetchOptions,
                  signal: controller.signal,
                });

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                clearTimeout(timeoutId);
                const text = await response.text();
                return text;
              } catch (error: any) {
                clearTimeout(timeoutId);
                throw new Error(error.message || 'Fetch failed');
              }
            },
            {
              url: config.url,
              headers: config.headers,
              body: config.body,
              timeout: config.timeout,
            }
          );

          // For POST with body, check if response is JSON or HTML
          if (responseText) {
            try {
              // Try to parse as JSON
              JSON.parse(responseText);
              // It's JSON, return directly
              return responseText;
            } catch {
              // Not JSON, set as HTML content for further processing
              await page.setContent(responseText, {
                waitUntil: 'domcontentloaded',
                timeout: config.timeout,
              });
            }
          }
        } else {
          // POST without body (query parameters in URL) - use navigation to preserve cookies
          await page.goto(config.url, {
            waitUntil: 'networkidle',
            timeout: config.timeout,
          });
        }
      }

      // Wait for selector if specified (useful for dynamic content)
      if (config.waitForSelector) {
        try {
          await page.waitForSelector(config.waitForSelector, { timeout: config.timeout });
        } catch (error) {
          // Selector not found, continue anyway
          console.warn(`Selector ${config.waitForSelector} not found, continuing...`);
        }
      }

      // Get content - try multiple methods
      let content: string;

      // For JSON endpoints, try to get the response body directly
      const mightBeJson = config.url.includes('LoadIn=html') ||
        config.url.includes('json') ||
        config.url.includes('api');

      if (mightBeJson) {
        try {
          // Try to get response via evaluate (intercept network response)
          content = await page.evaluate(async () => {
            // This won't work easily, so fall back to page content
            return document.body?.innerText || document.documentElement?.innerText || '';
          });

          // If we got content from evaluate, check if it looks like JSON
          if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
            console.log('✅ [PlaywrightScraper] Got JSON-like content from page');
            return content.trim();
          }
        } catch (e) {
          // Fall through to page.content()
        }
      }

      // Standard content extraction
      content = await page.content();

      // If content is mostly HTML but we expected JSON, check for JSON in script tags or body
      if (mightBeJson && content.includes('<')) {
        // Try to extract JSON from script tags or body content
        try {
          const jsonMatch = content.match(/{[\s\S]*?"HTML"[\s\S]*?"MODEL"[\s\S]*?}/);
          if (jsonMatch) {
            console.log('✅ [PlaywrightScraper] Found JSON in HTML, extracting...');
            return jsonMatch[0];
          }

          // Check if body contains JSON
          const bodyText = await page.evaluate(() => document.body?.innerText || '');
          if (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')) {
            console.log('✅ [PlaywrightScraper] Found JSON in body text');
            return bodyText.trim();
          }
        } catch (e) {
          // Fall through to return HTML content
        }
      }

      return content;
    } catch (error: any) {
      throw new Error(`Scraping failed: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if browser is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.browser !== null;
  }
}

