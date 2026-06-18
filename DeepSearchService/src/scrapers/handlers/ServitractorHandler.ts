import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { ISourceHandler } from './interfaces/ISourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SERVITRACTOR-specific handler
 * Contains ALL logic for SERVITRACTOR authentication and search - no dependencies on step executor
 * Uses iframe-based authentication with Zoho Creator Portal
 */
export class ServitractorHandler implements ISourceHandler {
  readonly originCode = 'SERVITRACTOR';

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
      const filepath = path.join(debugDir, `${filename}-${timestamp}.html`);
      fs.writeFileSync(filepath, html, 'utf-8');
      console.log(`[${this.originCode}] 📄 Logged HTML to: ${filepath}`);
      console.log(`[${this.originCode}] 📄 HTML length: ${html.length} characters`);
    } catch (error: any) {
      console.warn(`[${this.originCode}] ⚠️ Failed to log HTML: ${error.message}`);
    }
  }

  /**
   * Get iframe frame from page
   */
  private async getIframeFrame(page: Page, iframeSelector: string): Promise<any> {
    // Extract iframe name
    const nameMatch = iframeSelector.match(/name=["']([^"']+)["']/);
    if (nameMatch) {
      // Wait a bit for iframe to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      const frame = page.frames().find(f => f.name() === nameMatch[1]);
      if (frame) {
        // Wait for iframe content to be ready
        try {
          await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        } catch (e) {
          // If readyState check fails, just continue
        }
        return frame;
      }
    }
    
    // Try to get iframe element and then its content frame
    const iframeElement = await page.$(iframeSelector);
    if (iframeElement) {
      const frame = await iframeElement.contentFrame();
      if (frame) {
        // Wait for iframe content to be ready
        try {
          await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        } catch (e) {
          // If readyState check fails, just continue
        }
        return frame;
      }
    }
    
    // Fallback: wait for iframe and try again
    await page.waitForSelector(iframeSelector, { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const iframeEl = await page.$(iframeSelector);
    if (iframeEl) {
      const frame = await iframeEl.contentFrame();
      if (frame) {
        // Wait for iframe content to be ready
        try {
          await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 });
        } catch (e) {
          // If readyState check fails, just continue
        }
        return frame;
      }
    }
    
    throw new Error(`Could not access iframe: ${iframeSelector}`);
  }

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    const currentUrl = page.url();
    console.log(`[${this.originCode}] Current URL: ${currentUrl}`);
    
    try {
      // Navigate to the search page (Inicio1) to check authentication
      // If already authenticated, we'll see the search input; if not, we'll see the login iframe
      const searchPageUrl = 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1';
      
      if (!currentUrl.includes('Inicio1')) {
        console.log(`[${this.originCode}] Navigating to search page for auth check: ${searchPageUrl}`);
        await page.goto(searchPageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Wait for Zoho page to load (Zoho pages load dynamically)
        // Verified via browser testing: Zoho pages need time for iframe and dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Log HTML after page loads
        await this.logHtml(page, 'servitractor-auth-check-inicio1');
      } else {
        console.log(`[${this.originCode}] Already on search page, waiting for content to load...`);
        // Verified via browser testing: needs time for iframe to load
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const finalUrl = page.url();
      console.log(`[${this.originCode}] URL after navigation: ${finalUrl}`);

      // Wait a bit more for iframe to load (Zoho pages load dynamically)
      // Verified via browser testing: iframe[name="zohoiam"] is the correct selector
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for login iframe first - this is the most reliable indicator
      // The iframe appears when user needs to login
      // Verified via browser testing: iframe with name="zohoiam" contains the login form
      let loginIframe = await page.$('iframe[name="zohoiam"]');
      
      // If not found immediately, wait a bit more for Zoho's dynamic loading
      // Verified via browser testing: Zoho pages load iframe asynchronously
      if (!loginIframe) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        loginIframe = await page.$('iframe[name="zohoiam"]');
      }

      // If login iframe is found, we need to login
      // Verified via browser testing: iframe presence indicates authentication required
      if (loginIframe) {
        console.log(`[${this.originCode}] ❌ Detected login iframe - authentication required`);
        // Navigate to login page so login can start from the correct page
        const loginPageUrl = 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio';
        console.log(`[${this.originCode}] Navigating to login page: ${loginPageUrl}`);
        await page.goto(loginPageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        // Wait for login page to load
        // Verified via browser testing: Zoho pages need time for iframe to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Log HTML after login page loads
        await this.logHtml(page, 'servitractor-login-page');
        
        return false; // Not authenticated
      }

      // Continue with detailed checks if no iframe found
      const pageTitle = await page.title();
      console.log(`[${this.originCode}] Page title: ${pageTitle}`);
      
      // Check for login state in JavaScript (most reliable indicator)
      // Zoho pages store login info in JavaScript variables
      const loginState = await page.evaluate(() => {
        // Check for login variables in window/global scope
        const hasLoginName = typeof (window as any).loginName !== 'undefined' && (window as any).loginName;
        const hasLoginEmail = typeof (window as any).loginEmail !== 'undefined' && (window as any).loginEmail;
        const hasLoginZuid = typeof (window as any).loginZuid !== 'undefined' && (window as any).loginZuid;
        
        // Also check in document scripts (Zoho embeds login info in script tags)
        const scripts = Array.from(document.querySelectorAll('script'));
        let scriptHasLogin = false;
        for (const script of scripts) {
          const content = script.textContent || '';
          if (content.includes('loginName') && content.includes('loginEmail')) {
            scriptHasLogin = true;
            break;
          }
        }
        
        return {
          hasLoginName,
          hasLoginEmail,
          hasLoginZuid,
          scriptHasLogin,
          loginName: hasLoginName ? (window as any).loginName : null,
          loginEmail: hasLoginEmail ? (window as any).loginEmail : null
        };
      });
      
      console.log(`[${this.originCode}] Login state from JavaScript:`, loginState);
      
      // Also check for search form/input as positive indicator of authentication
      // Wait for dynamically loaded content - Zoho pages load forms asynchronously
      // Verified via browser testing: form[name="Busqueda"] and #zc-Busqueda are correct selectors
      let searchForm = null;
      let searchInput = null;
      try {
        // Wait for the form to appear (use waitForSelector with timeout)
        // Verified via browser testing: Zoho forms load asynchronously, need sufficient wait time
        try {
          await page.waitForSelector('form[name="Busqueda"]', { 
            visible: true, 
            timeout: 15000 
          }).catch(() => {
            // If not found, try again after a delay
            return new Promise(resolve => setTimeout(resolve, 3000));
          });
          searchForm = await page.$('form[name="Busqueda"]');
        } catch (e) {
          // Form not found, continue checking
        }
        
        // Try to find search input - wait for it to be visible
        // The search input is: <input id="zc-Busqueda" name="Busqueda" type="text" class="form-control zc_textfield zc-Busqueda">
        // Verified via browser testing: #zc-Busqueda is the correct selector when authenticated
        try {
          // Try multiple selectors, waiting for each
          // Priority: specific ID first, then form-based selectors
          const selectors = [
            '#zc-Busqueda',  // Most specific - the actual ID (verified via browser testing)
            'input#zc-Busqueda',  // Explicit input with ID
            'form[name="Busqueda"] input#zc-Busqueda',  // Within the form
            'form[name="Busqueda"] input[type="text"]',  // Text input in form
            'input[name="Busqueda"]',  // By name attribute
            'input.zc-Busqueda',  // By class
            '.zc-Busqueda input'  // Input within element with class
          ];
          
          for (const selector of selectors) {
            try {
              await page.waitForSelector(selector, { 
                visible: true, 
                timeout: 8000 
              });
              searchInput = await page.$(selector);
              if (searchInput) {
                // Verify it's actually the search input by checking attributes
                const inputInfo = await page.evaluate((el) => {
                  if (!el) return null;
                  const input = el as HTMLInputElement;
                  return {
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    className: input.className,
                    visible: input.offsetParent !== null
                  };
                }, searchInput);
                
                if (inputInfo && (inputInfo.id === 'zc-Busqueda' || inputInfo.name === 'Busqueda')) {
                  console.log(`[${this.originCode}] ✅ Found search input with selector: ${selector}`);
                  console.log(`[${this.originCode}]   Input info:`, inputInfo);
                  break;
                } else {
                  console.log(`[${this.originCode}] ⚠️ Found input but doesn't match search criteria:`, inputInfo);
                  searchInput = null; // Reset and try next selector
                }
              }
            } catch (e) {
              // Try next selector
              continue;
            }
          }
          
          // If still not found, try a more aggressive search using evaluate
          if (!searchInput) {
            console.log(`[${this.originCode}] Trying evaluate-based search for input...`);
            const foundInput = await page.evaluate(() => {
              // Try to find by ID first
              let input = document.getElementById('zc-Busqueda') as HTMLInputElement;
              if (input && input.offsetParent !== null) return true;
              
              // Try to find in form
              const form = document.querySelector('form[name="Busqueda"]');
              if (form) {
                input = form.querySelector('input#zc-Busqueda') as HTMLInputElement;
                if (input && input.offsetParent !== null) return true;
                
                input = form.querySelector('input[name="Busqueda"]') as HTMLInputElement;
                if (input && input.offsetParent !== null) return true;
              }
              
              return false;
            });
            
            if (foundInput) {
              // If found via evaluate, try to get it with a selector
              try {
                searchInput = await page.$('#zc-Busqueda');
                if (searchInput) {
                  console.log(`[${this.originCode}] ✅ Found search input using evaluate-based search`);
                }
              } catch (e) {
                // Ignore
              }
            }
          }
        } catch (e) {
          // Search input not found yet, continue with other checks
          console.warn(`[${this.originCode}] Error finding search input:`, e);
        }
      } catch (e) {
        // Search input not found yet, continue with other checks
        console.warn(`[${this.originCode}] Error checking for search form/input:`, e);
      }

      // User is authenticated if:
      // 1. No login iframe is present AND
      // 2. (Login info found in JavaScript OR search form/input is present)
      const hasLoginIframe = false; // Already checked above, if we got here, there's no iframe
      const hasLoginInJS = loginState.hasLoginName || loginState.hasLoginEmail || loginState.scriptHasLogin;
      const hasSearchForm = !!searchForm;
      const hasSearchInput = !!searchInput;
      
      // Authenticated if we have login info in JS OR search form/input
      const isAuthenticated = hasLoginInJS || hasSearchForm || hasSearchInput;
      
      console.log(`[${this.originCode}] Authentication check results:`);
      console.log(`[${this.originCode}]   - Login iframe found: ${hasLoginIframe}`);
      console.log(`[${this.originCode}]   - Login info in JS: ${hasLoginInJS} (name: ${loginState.loginName}, email: ${loginState.loginEmail})`);
      console.log(`[${this.originCode}]   - Search form found: ${hasSearchForm}`);
      console.log(`[${this.originCode}]   - Search input found: ${hasSearchInput}`);
      console.log(`[${this.originCode}]   - Page title: ${pageTitle}`);
      console.log(`[${this.originCode}]   - Authenticated: ${isAuthenticated}`);
      
      if (isAuthenticated) {
        const authReason = hasLoginInJS ? 'login info in JavaScript' : (hasSearchForm ? 'search form available' : 'search input available');
        console.log(`[${this.originCode}] ✅ Already authenticated (${authReason})`);
      } else {
        console.log(`[${this.originCode}] ❌ Not authenticated (no login info in JS, no search form/input found)`);
        // Navigate to login page so login can start from the correct page
        const loginPageUrl = 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio';
        console.log(`[${this.originCode}] Navigating to login page: ${loginPageUrl}`);
        await page.goto(loginPageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        // Wait for login page to load
        // Verified via browser testing: Zoho pages need time for iframe to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Log HTML after login page loads
        await this.logHtml(page, 'servitractor-login-page');
      }
      
      return isAuthenticated;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during auth check:`, error);
      return false;
    }
  }

  /**
   * Complete SERVITRACTOR scraping flow - all logic is here, no dependencies on step executor
   */
  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    console.log(`[${this.originCode}] Starting scrape for reference: ${reference}`);

    try {
      // Step 1: Check authentication
      let isAuthenticated = false;
      if (config.loginUrl) {
        isAuthenticated = await this.checkAuthentication(page, config.loginUrl);
      }

      // Step 2: Login if needed
      if (config.requiresLogin && !isAuthenticated) {
        console.log(`[${this.originCode}] Not authenticated, performing login...`);
        await this.performLogin(page, config);
      } else if (isAuthenticated) {
        console.log(`[${this.originCode}] Already authenticated, skipping login`);
      }

      // Step 3: Perform search
      console.log(`[${this.originCode}] Performing search for: ${reference}`);
      await this.performSearch(page, reference);

      // Step 4: Wait for results
      console.log(`[${this.originCode}] Waiting for search results...`);
      await page.waitForSelector(
        '[class*="result"], [class*="tile"], .zc-pb-tile-container, .zc-pb-tile-card',
        { timeout: 30000 }
      ).catch(() => {
        console.warn(`[${this.originCode}] ⚠️ Results selector not found, but continuing...`);
      });

      // Step 5: Get final content
      await new Promise(resolve => setTimeout(resolve, 2000));
      const content = await page.content();
      
      // Save HTML to file for debugging
      try {
        const debugDir = path.join(process.cwd(), 'debug-html');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `servitractor-search-result-${reference}-${timestamp}.html`;
        const filepath = path.join(debugDir, filename);
        fs.writeFileSync(filepath, content, 'utf-8');
        console.log(`[${this.originCode}] 📄 Saved search result HTML to: ${filepath}`);
        console.log(`[${this.originCode}] 📄 HTML length: ${content.length} characters`);
      } catch (error: any) {
        console.warn(`[${this.originCode}] ⚠️ Failed to save search result HTML: ${error.message}`);
      }
      
      console.log(`[${this.originCode}] ✅ Scrape complete, content length: ${content.length}`);
      return content;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during scrape:`, error);
      await this.logHtml(page, `servitractor-error-${reference}`);
      throw error;
    }
  }

  /**
   * Perform SERVITRACTOR login
   * Uses iframe-based authentication with Zoho Creator Portal
   */
  private async performLogin(page: Page, config: EndpointConfig): Promise<void> {
    console.log(`[${this.originCode}] Starting login process...`);

    try {
      // Navigate to login page
      const loginPageUrl = 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio';
      console.log(`[${this.originCode}] Navigating to login page: ${loginPageUrl}`);
      await page.goto(loginPageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      // Wait for Zoho page and iframe to load
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.logHtml(page, 'servitractor-initial-page');

      // Wait for login iframe to appear
      // Verified via browser testing: iframe[name="zohoiam"] contains the login form
      console.log(`[${this.originCode}] Waiting for login iframe...`);
      await page.waitForSelector('iframe[name="zohoiam"]', {
        timeout: 30000
      });

      // Get iframe frame
      const iframe = await this.getIframeFrame(page, 'iframe[name="zohoiam"]');

      // Wait for email input in iframe
      console.log(`[${this.originCode}] Waiting for email input in iframe...`);
      await iframe.waitForSelector('#login_id', {
        timeout: 30000,
        visible: true
      });

      // Fill email/username
      console.log(`[${this.originCode}] Filling email...`);
      const emailInput = await iframe.$('#login_id');
      if (emailInput) {
        await emailInput.click({ clickCount: 3 });
        await emailInput.type(config.loginUsername || '', { delay: 50 });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click "Siguiente" button to proceed to password
      console.log(`[${this.originCode}] Clicking "Siguiente" button...`);
      const siguienteButton = await iframe.$('#nextbtn');
      if (siguienteButton) {
        await siguienteButton.click();
      }
      
      // Wait for iframe to reload and password field to appear
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Re-acquire iframe (iframe content reloads after clicking Siguiente)
      await page.waitForSelector('iframe[name="zohoiam"]', {
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const iframeAfterClick = await this.getIframeFrame(page, 'iframe[name="zohoiam"]');

      // Wait for password input in reloaded iframe
      console.log(`[${this.originCode}] Waiting for password input in iframe...`);
      await iframeAfterClick.waitForSelector('#password', {
        timeout: 30000,
        visible: true
      });

      // Fill password
      console.log(`[${this.originCode}] Filling password...`);
      const passwordInput = await iframeAfterClick.$('#password');
      if (passwordInput) {
        await passwordInput.click({ clickCount: 3 });
        await passwordInput.type(config.loginPassword || '', { delay: 50 });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click "Iniciar sesión" button
      console.log(`[${this.originCode}] Clicking "Iniciar sesión" button...`);
      const loginButton = await iframeAfterClick.$('#nextbtn');
      if (loginButton) {
        await loginButton.click();
      }
      
      // Wait for login to complete and page to redirect
      await new Promise(resolve => setTimeout(resolve, 8000));
      await this.logHtml(page, 'servitractor-after-login');

      const afterLoginUrl = page.url();
      console.log(`[${this.originCode}] Login complete, current URL: ${afterLoginUrl}`);
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during login:`, error);
      throw error;
    }
  }

  /**
   * Perform SERVITRACTOR search
   */
  private async performSearch(page: Page, reference: string): Promise<void> {
    console.log(`[${this.originCode}] Performing search for: ${reference}`);

    try {
      // Navigate to the search page (Inicio1)
      const searchPageUrl = 'https://empresaservitractor.zohocreatorportal.com/#Page:Inicio1';
      console.log(`[${this.originCode}] Navigating to search page: ${searchPageUrl}`);
      await page.goto(searchPageUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      // Wait for Zoho page to fully load - Zoho pages load dynamically
      // Verified via browser testing: Zoho pages need significant time to load after redirect
      console.log(`[${this.originCode}] Waiting for Zoho page to fully load...`);
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Wait for the search form to appear on Inicio1 page
      // The search input is inside form[name="Busqueda"]
      // Verified via browser testing: form loads asynchronously after authentication
      console.log(`[${this.originCode}] Waiting for search form...`);
      await page.waitForSelector('form[name="Busqueda"]', {
        visible: true,
        timeout: 60000
      });
      
      // Additional wait after form appears to ensure input is ready
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for the search input field specifically
      // Verified via browser testing: #zc-Busqueda is the correct selector when authenticated
      console.log(`[${this.originCode}] Waiting for search input...`);
      const searchInputSelectors = [
        '#zc-Busqueda',
        'input[name="Busqueda"]',
        'form[name="Busqueda"] input[type="text"]',
        'form[name="Busqueda"] textbox'
      ];
      
      let searchInput = null;
      for (const selector of searchInputSelectors) {
        try {
          await page.waitForSelector(selector, {
            visible: true,
            timeout: 60000
          });
          searchInput = await page.$(selector);
          if (searchInput) {
            console.log(`[${this.originCode}] ✅ Found search input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!searchInput) {
        throw new Error('Search input not found');
      }

      // Additional wait to ensure input is fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fill search input
      console.log(`[${this.originCode}] Filling search input with: ${reference}`);
      await page.click('#zc-Busqueda, input[name="Busqueda"], form[name="Busqueda"] input[type="text"], form[name="Busqueda"] textbox', { clickCount: 3 });
      await page.type('#zc-Busqueda, input[name="Busqueda"], form[name="Busqueda"] input[type="text"], form[name="Busqueda"] textbox', reference, { delay: 50 });
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click the "Buscar" button (more reliable than Enter key for Zoho forms)
      // The button is inside the Busqueda form
      console.log(`[${this.originCode}] Clicking search button...`);
      await page.waitForSelector('form[name="Busqueda"] button, form[name="Busqueda"] button[type="submit"]', {
        timeout: 30000,
        visible: true
      });
      await page.click('form[name="Busqueda"] button, form[name="Busqueda"] button[type="submit"]');
      
      // Wait for search results to load (URL changes to result1)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Wait for URL to change to result1
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Wait for results content to appear (product information or "No se encontraron resultados")
      // Results page shows either product tiles or result content with product details
      console.log(`[${this.originCode}] Waiting for search results...`);
      await page.waitForSelector(
        '[class*="result"], [class*="tile"], .zc-pb-tile-container, .zc-pb-tile-card',
        { timeout: 30000 }
      ).catch(() => {
        console.warn(`[${this.originCode}] ⚠️ Results selector not found, but continuing...`);
      });
      
      // Log HTML after search
      await this.logHtml(page, `servitractor-search-results-${reference}`);
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during search:`, error);
      throw error;
    }
  }
}
