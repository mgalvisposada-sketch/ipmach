import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { BaseSourceHandler } from './BaseSourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GECOLSA-specific handler
 * Handles custom authentication check and search for GECOLSA (Caterpillar parts store)
 * All handlers return HTML content that parsers convert to standardized Product structure
 */
export class GecolsaHandler extends BaseSourceHandler {
  readonly originCode = 'GECOLSA';

  /**
   * Helper method to log HTML content to file
   */
  private async logHtml(page: Page, filename: string): Promise<void> {
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay to ensure page is ready
      const html = await page.content();
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize filename to handle special characters
      const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '-');
      const filepath = path.join(debugDir, `${sanitizedFilename}-${timestamp}.html`);
      fs.writeFileSync(filepath, html, 'utf-8');
      console.log(`[${this.originCode}] 📄 Logged HTML to: ${filepath}`);
      console.log(`[${this.originCode}] 📄 HTML length: ${html.length} characters`);
    } catch (error: any) {
      console.warn(`[${this.originCode}] ⚠️ Failed to log HTML: ${error.message}`);
    }
  }

  /**
   * Get browser options optimized for GECOLSA to handle HTTP2 protocol errors and connection issues
   * Forces HTTP/1.1 and optimizes network settings to prevent slow connection issues
   */
  getBrowserOptions?(): any {
    return {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        // Force HTTP/1.1 to avoid HTTP2 protocol errors
        '--disable-http2',
        '--disable-http2-server-push',
        // Network optimizations and connection stability
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        // Connection stability improvements
        '--disable-quic', // Disable QUIC protocol which can cause connection resets
        '--enable-tcp-fast-open', // Enable TCP fast open for faster connections
        '--aggressive-cache-discard', // Better cache management
        // Additional stability flags
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        // User agent to avoid detection
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
      ignoreHTTPSErrors: true,
      headless: true,
      // Connection timeout settings
      protocolTimeout: 120000, // 2 minutes for protocol operations
    };
  }

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    const currentUrl = page.url();
    console.log(`[${this.originCode}] Current URL: ${currentUrl}`);
    
    try {
      // Check if we're on the login page (signin.cat.com)
      if (currentUrl.includes('signin.cat.com')) {
        console.log(`[${this.originCode}] ❌ Not authenticated (on login page)`);
        return false;
      }
      
      // Wait a bit for page to load and JavaScript to execute
      // Verified via browser testing: page needs time for shadow DOM to render
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Log HTML after page loads
      await this.logHtml(page, 'gecolsa-auth-check');
      
      // Check for the specific login button: button with part="link", role="menuitem", and class "cat-c-utility-nav__link"
      // The button is inside shadow DOM of cat-utility-nav-item component
      // Verified via browser testing: shadow DOM contains login button when not authenticated
      // Also check for "Iniciar sesión" text in the page as fallback
      // If any of these exist, we need to login
      const loginButtonExists = await page.evaluate(() => {
        // Strategy 1: Look for button with part="link", role="menuitem", and class containing "cat-c-utility-nav__link"
        // Check inside shadow DOM of cat-utility-nav-item components
        const navItems = Array.from(document.querySelectorAll('cat-utility-nav-item'));
        let loginButton = null;
        
        for (const navItem of navItems) {
          if (navItem.shadowRoot) {
            const buttons = Array.from(navItem.shadowRoot.querySelectorAll('button'));
            const button = buttons.find(btn => {
              const part = btn.getAttribute('part');
              const role = btn.getAttribute('role');
              const classes = btn.className || '';
              return part === 'link' &&
                     role === 'menuitem' &&
                     classes.includes('cat-c-utility-nav__link');
            });
            if (button) {
              loginButton = button;
              break;
            }
          }
        }
        
        // Also check in regular DOM as fallback
        if (!loginButton) {
          const allElements = Array.from(document.querySelectorAll('*'));
          loginButton = allElements.find(el => {
            if (el.tagName.toLowerCase() !== 'button') return false;
            const part = el.getAttribute('part');
            const role = el.getAttribute('role');
            const classes = el.className || '';
            return part === 'link' &&
                   role === 'menuitem' &&
                   classes.includes('cat-c-utility-nav__link');
          }) || null;
        }
        
        // Strategy 2: Check for "Iniciar sesión" menu (fallback)
        const menus = Array.from(document.querySelectorAll('menu'));
        const signInMenu = menus.find(menu => {
          const ariaLabel = menu.getAttribute('aria-label')?.toLowerCase() || '';
          return ariaLabel.includes('iniciar sesión') || ariaLabel.includes('sign in');
        });
        
        // Strategy 3: Check for menuitem with "Iniciar sesión" text (fallback)
        const menuItems = Array.from(document.querySelectorAll('menuitem'));
        const signInMenuItem = menuItems.find(item => {
          const text = item.textContent?.toLowerCase() || '';
          return text.includes('iniciar sesión') || text.includes('sign in');
        });
        
        // Strategy 4: Check for custom web component "cat-utility-nav-item" with "Iniciar sesión" (GECOLSA uses this)
        const customNavItems = Array.from(document.querySelectorAll('cat-utility-nav-item'));
        const signInNavItem = customNavItems.find(item => {
          const ariaLabel = item.getAttribute('aria-label')?.toLowerCase() || '';
          const text = item.textContent?.toLowerCase() || '';
          return ariaLabel.includes('iniciar sesión') || 
                 ariaLabel.includes('sign in') ||
                 text.includes('iniciar sesión') ||
                 text.includes('sign in');
        });
        
        // Strategy 5: Check for "Iniciar sesión" text in page body with menu-like context (fallback)
        const bodyText = document.body?.textContent || '';
        const hasSignInText = bodyText.toLowerCase().includes('iniciar sesión') || 
                              bodyText.toLowerCase().includes('sign in');
        
        // Only consider it a login button if the text appears in a menu/menuitem/button context
        if (hasSignInText && !loginButton && !signInMenu && !signInMenuItem && !signInNavItem) {
          // Check if "Iniciar sesión" appears in a menu-like context
          const allElements = Array.from(document.querySelectorAll('*'));
          const elementsWithText = allElements.filter((el: Element) => {
            const text = el.textContent?.toLowerCase() || '';
            const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
            const tagName = el.tagName.toLowerCase();
            return (text.includes('iniciar sesión') || text.includes('sign in')) &&
                   (ariaLabel.includes('iniciar sesión') || ariaLabel.includes('sign in') ||
                    tagName === 'menu' || tagName === 'menuitem' ||
                    tagName === 'button' || tagName === 'a' ||
                    tagName === 'cat-utility-nav-item');
          });
          return elementsWithText.length > 0;
        }
        
        return !!(loginButton || signInMenu || signInMenuItem || signInNavItem);
      });
      
      console.log(`[${this.originCode}] Authentication indicators:`);
      console.log(`[${this.originCode}]   - Login button (cat-c-utility-nav__link) exists: ${loginButtonExists}`);
      
      // If login button DOESN'T exist, we're authenticated
      if (!loginButtonExists) {
        console.log(`[${this.originCode}] ✅ Already authenticated (no login button found)`);
        return true;
      }
      
      // If login button exists, we're not authenticated
      console.log(`[${this.originCode}] ❌ Not authenticated (login button found)`);
      // Log HTML when authentication is required
      await this.logHtml(page, 'gecolsa-login-page');
      return false;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during auth check:`, error);
      return false;
    }
  }

  /**
   * Override scrape method to handle GECOLSA-specific search flow
   * GECOLSA: Start by opening https://parts.cat.com/es/gecolsa, check for login button to determine auth
   * Uses request interception to block unnecessary resources and prevent HTTP2 errors
   */
  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    console.log(`[${this.originCode}] Starting scrape for reference: ${reference}`);
    
    // Step 1: Initial page state
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Initial URL: ${initialUrl}`);
    await this.logHtml(page, 'gecolsa-step1-initial');

    const placeholders: Record<string, string> = {
      username: config.loginUsername || '',
      password: config.loginPassword || '',
      reference: reference,
    };

    // Set up request interception to block unnecessary resources and prevent HTTP2 errors
    // This reduces bandwidth usage and prevents slow connection issues
    await page.setRequestInterception(true);
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra headers to improve connection stability
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      const url = request.url();
      
      // Block images, fonts, media, and other non-essential resources
      // This reduces bandwidth and prevents HTTP2 protocol errors from slow connections
      if (['image', 'font', 'media', 'websocket', 'manifest', 'texttrack'].includes(resourceType)) {
        request.abort();
      } 
      // Block third-party scripts and stylesheets that aren't essential
      else if (resourceType === 'stylesheet' && !url.includes('parts.cat.com') && !url.includes('cat.com')) {
        request.abort();
      }
      // Block analytics and tracking scripts
      else if (resourceType === 'script' && (
        url.includes('analytics') || 
        url.includes('google-analytics') || 
        url.includes('gtag') ||
        url.includes('facebook') ||
        url.includes('doubleclick')
      )) {
        request.abort();
      }
      // Allow all other requests
      else {
        request.continue();
      }
    });
    
    // Handle request failures gracefully
    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure();
      if (failure && (failure.errorText.includes('ERR_CONNECTION_RESET') || 
                      failure.errorText.includes('net::ERR_'))) {
        console.warn(`[${this.originCode}] ⚠️ Request failed (non-critical): ${url.substring(0, 100)} - ${failure.errorText}`);
      }
    });

    // Start by opening the GECOLSA page
    const gecolsaUrl = 'https://parts.cat.com/es/gecolsa';
    console.log(`[${this.originCode}] Navigating to GECOLSA page: ${gecolsaUrl}`);
    
    // Navigate with retry logic and exponential backoff to handle HTTP2 protocol errors
    let navigationSuccess = false;
    let retries = 5; // Increased retries
    let retryDelay = 1000; // Start with 1 second delay
    
    while (!navigationSuccess && retries > 0) {
      try {
        // Use load event instead of domcontentloaded for more reliable navigation
        // This ensures the page is more fully loaded before proceeding
        await page.goto(gecolsaUrl, {
          waitUntil: 'load', // Use 'load' for more reliable page loading
          timeout: 120000 // Increased timeout to 120 seconds for very slow connections
        });
        navigationSuccess = true;
        console.log(`[${this.originCode}] ✅ Navigation successful`);
        
        // Wait a moment for page to stabilize
        // Verified via browser testing: needs time for shadow DOM and custom components to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Log HTML immediately after navigation
        await this.logHtml(page, 'gecolsa-after-initial-navigation');
        console.log(`[${this.originCode}] 📄 Logged HTML after navigation to ${gecolsaUrl}`);
      } catch (error: any) {
        retries--;
        const errorMessage = error.message || '';
        const isProtocolError = errorMessage.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
                                errorMessage.includes('ERR_CONNECTION_RESET') ||
                                errorMessage.includes('ERR_CONNECTION_REFUSED') ||
                                errorMessage.includes('ERR_CONNECTION_TIMED_OUT') ||
                                errorMessage.includes('ERR_NETWORK_CHANGED') ||
                                errorMessage.includes('net::ERR_') ||
                                errorMessage.includes('Protocol error') ||
                                errorMessage.includes('Navigation timeout') ||
                                errorMessage.includes('Timeout') ||
                                errorMessage.includes('Target closed') ||
                                errorMessage.includes('Session closed');
        
        if (isProtocolError && retries > 0) {
          console.warn(`[${this.originCode}] Navigation error: ${errorMessage}, retries left: ${retries}, waiting ${retryDelay}ms`);
          
          // For connection reset errors, wait longer and try to reload the page
          if (errorMessage.includes('ERR_CONNECTION_RESET')) {
            console.log(`[${this.originCode}] Connection reset detected, waiting longer before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * 2)); // Wait even longer for connection resets
          } else {
            // Exponential backoff: wait longer between retries
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          retryDelay *= 2; // Double the delay for next retry (1s, 2s, 4s, 8s, 16s)
          continue;
        }
        
        // If it's not a protocol error or we're out of retries, throw
        if (retries === 0) {
          console.error(`[${this.originCode}] ❌ Navigation failed after all retries: ${errorMessage}`);
          throw error;
        }
      }
    }
    
    // Wait for page to load and JavaScript to execute
    // Verified via browser testing: needs time for shadow DOM and custom components to render
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.logHtml(page, 'gecolsa-after-page-load');

    // Check for "Iniciar sesión" button to determine if login is needed
    // This is the primary check - if button exists, we need to login
    // Verified via browser testing: shadow DOM in cat-utility-nav-item contains login button
    console.log(`[${this.originCode}] Checking for "Iniciar sesión" button...`);
    const needsLogin = await page.evaluate(() => {
      // Strategy 1: Look for button with part="link", role="menuitem", and class containing "cat-c-utility-nav__link"
      // Check inside shadow DOM of cat-utility-nav-item components
      const navItems = Array.from(document.querySelectorAll('cat-utility-nav-item'));
      let loginButton = null;
      
      for (const navItem of navItems) {
        if (navItem.shadowRoot) {
          const buttons = Array.from(navItem.shadowRoot.querySelectorAll('button'));
          const button = buttons.find(btn => {
            const part = btn.getAttribute('part');
            const role = btn.getAttribute('role');
            const classes = btn.className || '';
            return part === 'link' &&
                   role === 'menuitem' &&
                   classes.includes('cat-c-utility-nav__link');
          });
          if (button) {
            loginButton = button;
            break;
          }
        }
      }
      
      // Also check in regular DOM as fallback
      if (!loginButton) {
        const allElements = Array.from(document.querySelectorAll('*'));
        loginButton = allElements.find(el => {
          if (el.tagName.toLowerCase() !== 'button') return false;
          const part = el.getAttribute('part');
          const role = el.getAttribute('role');
          const classes = el.className || '';
          return part === 'link' &&
                 role === 'menuitem' &&
                 classes.includes('cat-c-utility-nav__link');
        }) || null;
      }
      
      // Strategy 2: Check for "Iniciar sesión" menu (fallback)
      const menus = Array.from(document.querySelectorAll('menu'));
      const signInMenu = menus.find(menu => {
        const ariaLabel = menu.getAttribute('aria-label')?.toLowerCase() || '';
        return ariaLabel.includes('iniciar sesión') || ariaLabel.includes('sign in');
      });
      
      // Strategy 3: Check for menuitem with "Iniciar sesión" text (fallback)
      const menuItems = Array.from(document.querySelectorAll('menuitem'));
      const signInMenuItem = menuItems.find(item => {
        const text = item.textContent?.toLowerCase() || '';
        return text.includes('iniciar sesión') || text.includes('sign in');
      });
      
      // Strategy 4: Check for custom web component "cat-utility-nav-item" with "Iniciar sesión" (GECOLSA uses this)
      const customNavItems = Array.from(document.querySelectorAll('cat-utility-nav-item'));
      const signInNavItem = customNavItems.find(item => {
        const ariaLabel = item.getAttribute('aria-label')?.toLowerCase() || '';
        const text = item.textContent?.toLowerCase() || '';
        return ariaLabel.includes('iniciar sesión') || 
               ariaLabel.includes('sign in') ||
               text.includes('iniciar sesión') ||
               text.includes('sign in');
      });
      
      // Strategy 5: Check for "Iniciar sesión" text in page body with menu-like context (fallback)
      const bodyText = document.body?.textContent || '';
      const hasSignInText = bodyText.toLowerCase().includes('iniciar sesión') || 
                            bodyText.toLowerCase().includes('sign in');
      
      // Only consider it a login button if the text appears in a menu/menuitem/button context
      if (hasSignInText && !loginButton && !signInMenu && !signInMenuItem && !signInNavItem) {
        // Check if "Iniciar sesión" appears in a menu-like context
        const allElements = Array.from(document.querySelectorAll('*'));
        const elementsWithText = allElements.filter((el: Element) => {
          const text = el.textContent?.toLowerCase() || '';
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
          const tagName = el.tagName.toLowerCase();
          return (text.includes('iniciar sesión') || text.includes('sign in')) &&
                 (ariaLabel.includes('iniciar sesión') || ariaLabel.includes('sign in') ||
                  tagName === 'menu' || tagName === 'menuitem' ||
                  tagName === 'button' || tagName === 'a' ||
                  tagName === 'cat-utility-nav-item');
        });
        return elementsWithText.length > 0;
      }
      
      return !!(loginButton || signInMenu || signInMenuItem || signInNavItem);
    });

    const isAuthenticated = !needsLogin;
    
    console.log(`[${this.originCode}] "Iniciar sesión" button check: ${needsLogin ? 'FOUND - Login required' : 'NOT FOUND - Already authenticated'}`);
    await this.logHtml(page, `gecolsa-auth-check-${isAuthenticated ? 'authenticated' : 'needs-login'}`);

    // If "Iniciar sesión" button is found, execute login
    if (needsLogin && config.requiresLogin && config.loginSteps && config.loginSteps.length > 0) {
      console.log(`[${this.originCode}] "Iniciar sesión" button found - Starting login process...`);
      await this.logHtml(page, 'gecolsa-before-login-steps');
      
      // Execute login steps using step-executor
      const { executeSteps } = await import('../step-executor');
      await executeSteps(page, config.loginSteps, placeholders, false, this.originCode);
      
      // Wait for redirect back to parts.cat.com after login
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.logHtml(page, 'gecolsa-after-login-steps');
      
      // Navigate back to GECOLSA page after login with retry logic
      console.log(`[${this.originCode}] Navigating back to GECOLSA page after login...`);
      let postLoginNavigationSuccess = false;
      let postLoginRetries = 5;
      let postLoginRetryDelay = 1000;
      while (!postLoginNavigationSuccess && postLoginRetries > 0) {
        try {
          await page.goto(gecolsaUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 90000
          });
          postLoginNavigationSuccess = true;
          console.log(`[${this.originCode}] ✅ Post-login navigation successful`);
          await this.logHtml(page, 'gecolsa-after-post-login-navigation');
        } catch (error: any) {
          postLoginRetries--;
          const errorMessage = error.message || '';
          const isProtocolError = errorMessage.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
                                  errorMessage.includes('net::ERR_') ||
                                  errorMessage.includes('Protocol error') ||
                                  errorMessage.includes('Navigation timeout');
          
          if (isProtocolError && postLoginRetries > 0) {
            console.warn(`[${this.originCode}] Post-login navigation error: ${errorMessage}, retries left: ${postLoginRetries}, waiting ${postLoginRetryDelay}ms`);
            await new Promise(resolve => setTimeout(resolve, postLoginRetryDelay));
            postLoginRetryDelay *= 2;
            continue;
          }
          if (postLoginRetries === 0) {
            console.error(`[${this.originCode}] ❌ Post-login navigation failed after all retries: ${errorMessage}`);
            throw error;
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.logHtml(page, 'gecolsa-post-login-wait-complete');
    } else if (!needsLogin) {
      // "Iniciar sesión" button NOT found - already authenticated, proceed directly to search
      console.log(`[${this.originCode}] "Iniciar sesión" button NOT found - Already authenticated, proceeding to search`);
      await this.logHtml(page, 'gecolsa-skipped-login-authenticated');
    } else {
      console.log(`[${this.originCode}] Login required but no login steps configured`);
    }

    // Build search URL with reference
    // Verified via browser testing: URL format is https://parts.cat.com/es/gecolsa/search?q={reference}&p_page=1
    const searchUrl = config.url?.replace('{{reference}}', reference) || `https://parts.cat.com/es/gecolsa/search?q=${reference}&p_page=1`;
    
    // Navigate to search URL with retry logic
    console.log(`[${this.originCode}] Navigating to search URL: ${searchUrl}`);
    await this.logHtml(page, 'gecolsa-before-search-navigation');
    let searchNavigationSuccess = false;
    let searchRetries = 5;
    let searchRetryDelay = 1000;
    while (!searchNavigationSuccess && searchRetries > 0) {
      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded', // Use domcontentloaded to avoid waiting for all resources
          timeout: 90000 // Increased timeout for slow connections
        });
        searchNavigationSuccess = true;
        console.log(`[${this.originCode}] ✅ Search navigation successful`);
        await this.logHtml(page, 'gecolsa-after-search-navigation');
      } catch (error: any) {
        searchRetries--;
        const errorMessage = error.message || '';
        const isProtocolError = errorMessage.includes('ERR_HTTP2_PROTOCOL_ERROR') || 
                                errorMessage.includes('net::ERR_') ||
                                errorMessage.includes('Protocol error') ||
                                errorMessage.includes('Navigation timeout');
        
        if (isProtocolError && searchRetries > 0) {
          console.warn(`[${this.originCode}] Search navigation error: ${errorMessage}, retries left: ${searchRetries}, waiting ${searchRetryDelay}ms`);
          await new Promise(resolve => setTimeout(resolve, searchRetryDelay));
          searchRetryDelay *= 2;
          continue;
        }
        if (searchRetries === 0) {
          console.error(`[${this.originCode}] ❌ Search navigation failed after all retries: ${errorMessage}`);
          throw error;
        }
      }
    }
    
    // Wait for search results to load and JavaScript to execute
    // Verified via browser testing: page title changes to "Resultados de búsqueda" when results load
    await new Promise(resolve => setTimeout(resolve, 5000));
    await this.logHtml(page, 'gecolsa-after-search-wait');
    
    // Wait for search results selector if provided
    // Verified via browser testing: products appear with various class names containing "product" or "item"
    if (config.waitForSelector) {
      try {
        console.log(`[${this.originCode}] Waiting for selector: ${config.waitForSelector}`);
        await page.waitForSelector(config.waitForSelector, { timeout: config.timeoutMs || 30000 });
        await this.logHtml(page, `gecolsa-after-wait-selector-${reference}`);
      } catch (e) {
        console.warn(`[${this.originCode}] Wait for selector timed out: ${config.waitForSelector}`);
        await this.logHtml(page, `gecolsa-wait-selector-timeout-${reference}`);
      }
    } else {
      // Additional wait for results to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.logHtml(page, `gecolsa-after-wait-timeout-${reference}`);
    }

    // Get page content
    await this.logHtml(page, `gecolsa-before-content-extraction-${reference}`);
    const content = await page.content();
    
    // Save HTML to file for debugging
    try {
      const fs = await import('fs');
      const path = await import('path');
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Sanitize reference for filename (replace invalid characters)
      const sanitizedReference = reference.replace(/[<>:"/\\|?*]/g, '-');
      const filename = `${this.originCode.toLowerCase()}-search-result-${sanitizedReference}-${timestamp}.html`;
      const filepath = path.join(debugDir, filename);
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`[${this.originCode}] 📄 Saved search result HTML to: ${filepath}`);
      console.log(`[${this.originCode}] 📄 HTML length: ${content.length} characters`);
    } catch (error: any) {
      console.warn(`[${this.originCode}] ⚠️ Failed to save search result HTML: ${error.message}`);
    }

    // Final step: Log final state
    await this.logHtml(page, `gecolsa-final-${reference}`);
    
    return content;
  }
}

