import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { BaseSourceHandler } from './BaseSourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MONTECARLO-specific handler
 * Handles complete execution flow directly without using step-executor
 * All handlers return HTML content that parsers convert to standardized Product structure
 */
export class MontecarloHandler extends BaseSourceHandler {
  readonly originCode = 'MONTECARLO';

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
      // Sanitize filename to handle special characters (like / in reference)
      const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '-');
      const filepath = path.join(debugDir, `${sanitizedFilename}-${timestamp}.html`);
      fs.writeFileSync(filepath, html, 'utf-8');
      console.log(`[${this.originCode}] 📄 Logged HTML to: ${filepath}`);
      console.log(`[${this.originCode}] 📄 HTML length: ${html.length} characters`);
    } catch (error: any) {
      console.warn(`[${this.originCode}] ⚠️ Failed to log HTML: ${error.message}`);
    }
  }

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Current URL: ${initialUrl}`);
    
    try {
      // Always navigate to the shop page to check authentication
      console.log(`[${this.originCode}] Navigating to shop page for auth check...`);
      await page.goto('https://portal.imm.com.co/shop', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentUrl = page.url();
      console.log(`[${this.originCode}] URL after navigation: ${currentUrl}`);
      
      // Log HTML immediately after first URL load
      await this.logHtml(page, 'montecarlo-first-url-load');
      
      // Log HTML after navigation to shop page
      await this.logHtml(page, 'montecarlo-auth-check-shop');
      
      // Check for the login button: <a href="/web/login" class="o_nav_link_btn nav-link border px-3">Iniciar sesión</a>
      const loginButton = await page.$('a[href="/web/login"].o_nav_link_btn.nav-link.border.px-3');
      
      if (loginButton) {
        // Check if the button contains the text "Iniciar sesión"
        const buttonText = await page.evaluate((el) => el?.textContent?.trim(), loginButton);
        console.log(`[${this.originCode}] Login button found with text: "${buttonText}"`);
        
        if (buttonText && buttonText.includes('Iniciar sesión')) {
          console.log(`[${this.originCode}] ❌ Not authenticated (login button "Iniciar sesión" found)`);
          // Log HTML when authentication is required
          await this.logHtml(page, 'montecarlo-login-page');
          return false;
        }
      }
      
      // Alternative check: look for any link with href="/web/login" containing "Iniciar sesión"
      const loginLink = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href="/web/login"]'));
        return links.find(link => link.textContent?.trim().includes('Iniciar sesión'));
      });
      
      if (loginLink) {
        console.log(`[${this.originCode}] ❌ Not authenticated (login link "Iniciar sesión" found)`);
        // Log HTML when authentication is required
        await this.logHtml(page, 'montecarlo-login-page');
        return false;
      }
      
      // If no login button found, we're authenticated and can proceed with search
      console.log(`[${this.originCode}] ✅ Already authenticated (no login button found, can proceed with search)`);
      return true;
    } catch (error: any) {
      console.warn(`[${this.originCode}] Error during auth check:`, error.message);
      return false;
    }
  }

  /**
   * Implement scrape method directly without using step-executor
   * Executes all steps through browser directly
   */
  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    console.log(`[${this.originCode}] Starting scrape for reference: ${reference}`);
    
    // Step 1: Initial page state
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Initial URL: ${initialUrl}`);
    await this.logHtml(page, 'montecarlo-step1-initial');

    try {
      // Check authentication
      let isAuthenticated = false;
      if (config.loginUrl) {
        console.log(`[${this.originCode}] Checking authentication...`);
        isAuthenticated = await this.checkAuthentication(page, config.loginUrl);
      }

      // Execute login if needed
      if (config.requiresLogin && !isAuthenticated) {
        console.log(`[${this.originCode}] Not authenticated, executing login...`);
        
        // Navigate to login page
        console.log(`[${this.originCode}] Navigating to login page...`);
        await page.goto('https://portal.imm.com.co/web/login', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.logHtml(page, 'montecarlo-login-page-loaded');

        // Wait for and fill email/username
        console.log(`[${this.originCode}] Waiting for email input...`);
        await page.waitForSelector('input[name="login"], input#login, input[type="text"]', {
          timeout: 30000,
          visible: true
        });
        await this.logHtml(page, 'montecarlo-before-email-fill');
        await page.type('input[name="login"], input#login, input[type="text"]', config.loginUsername || '', { delay: 50 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[${this.originCode}] Email filled`);
        await this.logHtml(page, 'montecarlo-after-email-fill');

        // Wait for and fill password
        console.log(`[${this.originCode}] Waiting for password input...`);
        await page.waitForSelector('input[type="password"]', {
          timeout: 30000,
          visible: true
        });
        await this.logHtml(page, 'montecarlo-before-password-fill');
        await page.type('input[type="password"]', config.loginPassword || '', { delay: 50 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[${this.originCode}] Password filled`);
        await this.logHtml(page, 'montecarlo-after-password-fill');

        // Click login button
        console.log(`[${this.originCode}] Clicking login button...`);
        // Wait for the login form to be visible first
        await page.waitForSelector('form.oe_login_form', {
          timeout: 30000,
          visible: true
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Additional wait for form to be ready
        
        // Try multiple selectors for the submit button
        const submitSelectors = [
          'form.oe_login_form button[type="submit"]',
          'form.oe_login_form button.btn-primary',
          'button[type="submit"].btn-primary',
          'button[type="submit"]'
        ];
        
        let submitButtonFound = false;
        for (const selector of submitSelectors) {
          try {
            await page.waitForSelector(selector, {
              timeout: 5000,
              visible: true
            });
            await this.logHtml(page, 'montecarlo-before-login-submit');
            await page.click(selector);
            submitButtonFound = true;
            console.log(`[${this.originCode}] Login button clicked using selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`[${this.originCode}] Selector ${selector} not found, trying next...`);
            continue;
          }
        }
        
        if (!submitButtonFound) {
          throw new Error('Could not find login submit button with any selector');
        }
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for redirect to start
        await this.logHtml(page, 'montecarlo-after-login-click');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for login to complete and redirect
        console.log(`[${this.originCode}] Login submitted`);
        await this.logHtml(page, 'montecarlo-after-login-redirect');
      } else if (isAuthenticated) {
        console.log(`[${this.originCode}] Already authenticated, skipping login`);
        await this.logHtml(page, 'montecarlo-skipped-login-authenticated');
      }

      // Navigate to shop page (if not already there)
      const currentUrl = page.url();
      if (!currentUrl.includes('/shop')) {
        console.log(`[${this.originCode}] Navigating to shop page...`);
        await page.goto('https://portal.imm.com.co/shop', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.logHtml(page, 'montecarlo-shop-page');
      }

      // Wait for search input
      console.log(`[${this.originCode}] Waiting for search input...`);
      
      // Wait for the shop page form to be ready first
      await page.waitForSelector('form.o_wsale_products_searchbar_form, form.s_searchbar_input', {
        timeout: 30000,
        visible: true
      }).catch(() => {
        console.log(`[${this.originCode}] Shop search form not found immediately, continuing...`);
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Additional wait for form to be ready
      
      // Try multiple selectors for the search input
      const searchSelectors = [
        'form.o_wsale_products_searchbar_form input[type="search"][name="search"]',
        'form.s_searchbar_input input[type="search"][name="search"]',
        'input[type="search"][name="search"].oe_search_box',
        'input.oe_search_box[type="search"]',
        'input.search-query[type="search"]',
        'input[type="search"][name="search"]',
        'input.oe_search_box',
        'input.search-query',
        'input[placeholder="Buscar..."]'
      ];
      
      let searchInputFound = false;
      for (const selector of searchSelectors) {
        try {
          await page.waitForSelector(selector, {
            timeout: 5000,
            visible: true
          });
          console.log(`[${this.originCode}] Search input found using selector: ${selector}`);
          await this.logHtml(page, 'montecarlo-search-input-found');
          searchInputFound = true;
          break;
        } catch (e) {
          console.log(`[${this.originCode}] Selector ${selector} not found, trying next...`);
          continue;
        }
      }
      
      if (!searchInputFound) {
        await this.logHtml(page, 'montecarlo-search-input-not-found');
        throw new Error('Could not find search input with any selector');
      }

      // Fill search input with reference
      console.log(`[${this.originCode}] Filling search input with reference: ${reference}`);
      // Use the most specific selector that should work
      const searchSelector = 'form.o_wsale_products_searchbar_form input[type="search"][name="search"], form.s_searchbar_input input[type="search"][name="search"], input[type="search"][name="search"].oe_search_box, input.oe_search_box[type="search"], input[type="search"][name="search"]';
      await page.focus(searchSelector);
      await this.logHtml(page, 'montecarlo-before-search-fill');
      await page.evaluate((selector) => {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          input.value = '';
        }
      }, searchSelector);
      await page.type(searchSelector, reference, { delay: 50 });
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[${this.originCode}] Search input filled`);
      await this.logHtml(page, `montecarlo-after-search-fill-${reference}`);

      // Press Enter to submit search
      console.log(`[${this.originCode}] Pressing Enter to submit search...`);
      await page.focus(searchSelector);
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.logHtml(page, 'montecarlo-before-search-submit');
      await page.keyboard.press('Enter');
      
      // Wait for navigation to start (URL change or form submission)
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.logHtml(page, 'montecarlo-after-enter-press');
      
      // Wait for search results page to load - wait for products grid
      console.log(`[${this.originCode}] Waiting for products grid to load...`);
      try {
        // Wait for the products grid section to appear
        await page.waitForSelector('#o_wsale_products_grid, section.o_wsale_products_grid_table, .oe_product', {
          timeout: config.timeoutMs || 30000,
          visible: true
        });
        console.log(`[${this.originCode}] Products grid found`);
      } catch (err: any) {
        console.warn(`[${this.originCode}] Products grid not found immediately: ${err.message}`);
      }
      
      // Additional wait for products to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`[${this.originCode}] Search submitted and results loaded`);
      await this.logHtml(page, `montecarlo-after-search-submit-${reference}`);

      // Wait for product elements to be visible (for parsing)
      console.log(`[${this.originCode}] Waiting for product elements...`);
      try {
        await page.waitForSelector('.oe_product, .o_wsale_product_grid_wrapper', {
          timeout: 10000,
          visible: true
        });
        console.log(`[${this.originCode}] Product elements found`);
      } catch (err: any) {
        console.warn(`[${this.originCode}] Product elements not found: ${err.message}`);
      }

      // Wait for content to load (use config selector if provided)
      if (config.waitForSelector) {
        console.log(`[${this.originCode}] Waiting for additional selector: ${config.waitForSelector}`);
        await page.waitForSelector(config.waitForSelector, { timeout: config.timeoutMs || 30000 }).catch((err) => {
          console.warn(`[${this.originCode}] WaitForSelector timeout: ${err.message}`);
        });
        await this.logHtml(page, `montecarlo-after-wait-selector-${reference}`);
      } else {
        // Default: wait a bit more for any dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.logHtml(page, `montecarlo-after-wait-timeout-${reference}`);
      }

      // Get page content
      await this.logHtml(page, `montecarlo-before-content-extraction-${reference}`);
      const content = await page.content();
      
      // Save HTML to file for debugging
      try {
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
      await this.logHtml(page, `montecarlo-final-${reference}`);
      
      return content;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during scrape:`, error);
      await this.logHtml(page, `montecarlo-error-${reference}`);
      throw error;
    }
  }
}
