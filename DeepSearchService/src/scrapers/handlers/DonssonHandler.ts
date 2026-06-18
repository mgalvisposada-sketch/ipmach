import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { ISourceHandler } from './interfaces/ISourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DONSSON-specific handler
 * Contains ALL logic for DONSSON authentication and search - no dependencies on generic scraper
 */
export class DonssonHandler implements ISourceHandler {
  readonly originCode = 'DONSSON';

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Current URL: ${initialUrl}`);

      // Navigate directly to shop page to check for login link
      // Note: Site redirects /shop to /en_US/shop (verified via browser testing)
    try {
      const shopUrl = 'https://www.donsson.com/shop';
      if (!initialUrl.includes('/shop')) {
        console.log(`[${this.originCode}] Navigating to shop page for auth check...`);
        await page.goto(shopUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for page to be fully loaded and stable
        console.log(`[${this.originCode}] Waiting for page elements to be ready...`);
        try {
          await page.waitForFunction(
            () => {
              const loginLink = document.querySelector('a[href*="/web/login"]');
              const searchInput = document.querySelector('#s2id_autogen1_search') ||
                                 document.querySelector('input.select2-input') ||
                                 document.querySelector('input[role="combobox"]') ||
                                 document.querySelector('#busqueda_maestra_id');
              const body = document.body;

              const shopContent = document.querySelector('.oe_product') ||
                                 document.querySelector('.product') ||
                                 document.querySelector('.shop') ||
                                 document.querySelector('#products_grid');

              return body && body.innerHTML.length > 1000 &&
                     (loginLink || searchInput || shopContent);
            },
            {
              timeout: 15000,
              polling: 200
            }
          );
          console.log(`[${this.originCode}] ✅ Page elements are ready`);
        } catch (waitError: any) {
          console.warn(`[${this.originCode}] ⚠️  Timeout waiting for specific elements, but continuing...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        console.log(`[${this.originCode}] Already on shop page, waiting for stability...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`[${this.originCode}] Navigation completed`);
      console.log(`[${this.originCode}]   - Final URL: ${currentUrl}`);
      console.log(`[${this.originCode}]   - Page title: ${pageTitle}`);

      // Save HTML to file for debugging
      try {
        const html = await page.content();
        const debugDir = path.join(process.cwd(), 'debug-html');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `donsson-auth-check-${timestamp}.html`;
        const filepath = path.join(debugDir, filename);
        fs.writeFileSync(filepath, html, 'utf-8');
        console.log(`[${this.originCode}] 📄 Saved HTML to: ${filepath}`);
        console.log(`[${this.originCode}] 📄 HTML length: ${html.length} characters`);
      } catch (error: any) {
        console.warn(`[${this.originCode}] ⚠️ Failed to save HTML: ${error.message}`);
      }

      // Check for login link (check both /web/login and /en_US/web/login)
      const loginLinks = await page.$$eval('a[href*="/web/login"], a[href*="/login"]', (links) => {
        return links.map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim() || ''
        }));
      });

      const loginLink = loginLinks.find(link => {
        const text = link.text.toLowerCase();
        return text.includes('sign in') ||
               text.includes('iniciar sesión') ||
               text.includes('iniciar sesion') ||
               text.includes('login');
      });

      const searchInput = await page.$('#s2id_autogen1_search, input.select2-input, input[role="combobox"]');
      const passwordField = await page.$('#password, input[name="password"], input[type="password"]');

      console.log(`[${this.originCode}] Authentication check results:`);
      console.log(`[${this.originCode}]   - Total login links found: ${loginLinks.length}`);
      console.log(`[${this.originCode}]   - Matching login link found: ${!!loginLink}`);
      console.log(`[${this.originCode}]   - Search input found: ${!!searchInput}`);
      console.log(`[${this.originCode}]   - Password field found: ${!!passwordField}`);

      // If we're on shop page (including /en_US/shop redirect), have search input, no login link, and no password field, we're authenticated
      // Verified via browser testing: site redirects /shop to /en_US/shop
      if ((currentUrl.includes('/shop') || currentUrl.includes('/en_US/shop')) && searchInput && !loginLink && !passwordField) {
        console.log(`[${this.originCode}] ✅ Already authenticated (on shop page with search input)`);
        return true;
      }

      // If we have a login link, we need to login
      if (loginLink) {
        console.log(`[${this.originCode}] ❌ Not authenticated (login link found)`);
        return false;
      }

      // Default: assume not authenticated if unclear
      console.log(`[${this.originCode}] ⚠️  Authentication status unclear, assuming not authenticated`);
      return false;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during auth check:`, error);
      return false;
    }
  }

  /**
   * Complete DONSSON scraping flow - all logic is here, no dependencies on generic scraper
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

      // Step 3: Navigate to shop page (if not already there)
      // Note: Site redirects /shop to /en_US/shop (verified via browser testing)
      const currentUrl = page.url();
      if (!currentUrl.includes('/shop')) {
        console.log(`[${this.originCode}] Navigating to shop page...`);
        await page.goto('https://www.donsson.com/shop', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        // Wait for potential redirect to /en_US/shop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Step 4: Perform search
      console.log(`[${this.originCode}] Performing search for: ${reference}`);
      await this.performSearch(page, reference);

      // Step 5: Wait for results
      // Verified via browser testing: products appear with various class names
      console.log(`[${this.originCode}] Waiting for search results...`);
      await page.waitForFunction(
        () => {
          const url = window.location.href;
          const hasProducts = document.querySelector('.oe_product, .product, [class*="product"]');
          const hasSearchParams = url.includes('search=') || url.includes('valor_buscado=');
          return hasSearchParams || hasProducts;
        },
        { timeout: 20000 }
      );

      // Step 6: Get final content
      await new Promise(resolve => setTimeout(resolve, 2000));
      const content = await page.content();
      
      // Save HTML to file for debugging
      try {
        const debugDir = path.join(process.cwd(), 'debug-html');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `donsson-search-result-${reference}-${timestamp}.html`;
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
      throw error;
    }
  }

  /**
   * Perform DONSSON login
   */
  private async performLogin(page: Page, config: EndpointConfig): Promise<void> {
    console.log(`[${this.originCode}] Starting login process...`);

    try {
      // Navigate to login page
      // Note: Site redirects /web/login to /en_US/web/login (verified via browser testing)
      const loginUrl = 'https://www.donsson.com/web/login';
      console.log(`[${this.originCode}] Navigating to login page: ${loginUrl}`);
      await page.goto(loginUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      // Wait for potential redirect and page load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Wait for and fill username field
      // Verified via browser testing: #login is the correct selector
      console.log(`[${this.originCode}] Filling username...`);
      await page.waitForSelector('#login, input[name="login"], input#login', {
        timeout: 30000,
        visible: true
      });
      await page.type('#login, input[name="login"], input#login', config.loginUsername || '', { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for and fill password field
      // Verified via browser testing: #password is the correct selector
      console.log(`[${this.originCode}] Filling password...`);
      await page.waitForSelector('#password, input[name="password"], input#password', {
        timeout: 30000,
        visible: true
      });
      await page.type('#password, input[name="password"], input#password', config.loginPassword || '', { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click login button
      // Verified via browser testing: button[type="submit"] with text "Log in" is correct
      console.log(`[${this.originCode}] Clicking login button...`);
      await page.waitForSelector('button[type="submit"]', { timeout: 30000 });
      await page.click('button[type="submit"]');
      
      // Wait for navigation after login
      // Note: May redirect to Odoo portal (/web#) or shop page
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        // Navigation might not occur if already on target page
        console.log(`[${this.originCode}] Navigation wait completed or timed out, continuing...`);
      });
      await new Promise(resolve => setTimeout(resolve, 3000));

      const afterLoginUrl = page.url();
      console.log(`[${this.originCode}] Login complete, current URL: ${afterLoginUrl}`);

      // If redirected to Odoo portal, navigate to shop
      // Note: Site redirects /shop to /en_US/shop (verified via browser testing)
      if (afterLoginUrl.includes('/web#') || afterLoginUrl.includes('menu_id')) {
        console.log(`[${this.originCode}] Redirected to Odoo portal, navigating to shop...`);
        await page.goto('https://www.donsson.com/shop', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        // Wait for potential redirect to /en_US/shop
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during login:`, error);
      throw error;
    }
  }

  /**
   * Perform DONSSON search
   */
  private async performSearch(page: Page, reference: string): Promise<void> {
    console.log(`[${this.originCode}] Performing search for: ${reference}`);

    try {
      // Wait for Select2 search container to be ready
      // Verified via browser testing: #s2id_busqueda_maestra_id is the correct selector
      await page.waitForSelector('#s2id_busqueda_maestra_id, .select2-container', {
        timeout: 30000,
        visible: true
      });
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Open Select2 dropdown using JavaScript to avoid overlay blocking
      console.log(`[${this.originCode}] Opening Select2 dropdown...`);
      await page.evaluate(() => {
        // Find Select2 container
        const container = document.querySelector('#s2id_busqueda_maestra_id') as HTMLElement;
        if (container) {
          // Trigger click event directly on the container
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          container.dispatchEvent(clickEvent);
          
          // Also try jQuery if available (Select2 uses jQuery)
          if ((window as any).jQuery && (window as any).jQuery.fn.select2) {
            const $container = (window as any).jQuery('#s2id_busqueda_maestra_id');
            if ($container.length) {
              $container.select2('open');
            }
          }
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for Select2 search input to be visible and fill it
      // Verified via browser testing: #s2id_autogen1_search is the correct selector
      console.log(`[${this.originCode}] Filling search input...`);
      await page.waitForSelector('#s2id_autogen1_search, input.select2-input', {
        timeout: 30000,
        visible: true
      });
      
      // Fill search input using JavaScript to ensure it works
      await page.evaluate((ref: string) => {
        const searchInput = document.querySelector('#s2id_autogen1_search, input.select2-input') as HTMLInputElement;
        if (searchInput) {
          // Clear and set value
          searchInput.value = '';
          searchInput.focus();
          
          // Trigger input events
          const inputEvent = new Event('input', { bubbles: true });
          const keyupEvent = new Event('keyup', { bubbles: true });
          
          // Type character by character to trigger Select2 events
          for (let i = 0; i < ref.length; i++) {
            searchInput.value = ref.substring(0, i + 1);
            searchInput.dispatchEvent(inputEvent);
            searchInput.dispatchEvent(keyupEvent);
          }
        }
      }, reference);
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Press Enter to submit search
      console.log(`[${this.originCode}] Pressing Enter to submit search...`);
      await page.keyboard.press('Enter');
      // Wait for search results to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during search:`, error);
      throw error;
    }
  }
}

