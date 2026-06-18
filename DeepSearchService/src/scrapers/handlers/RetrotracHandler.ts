import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { BaseSourceHandler } from './BaseSourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RETROTRAC-specific handler
 * Handles custom authentication check for RETROTRAC (Angular-based application)
 * All handlers return HTML content that parsers convert to standardized Product structure
 */
export class RetrotracHandler extends BaseSourceHandler {
  readonly originCode = 'RETROTRAC';

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

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Current URL: ${initialUrl}`);
    
    try {
      // Check if we're already on a non-login page (likely authenticated)
      // RETROTRAC redirects to /home after successful login
      if (initialUrl.includes('/home') || (initialUrl.includes('retrotrac.com') && !initialUrl.includes('/login'))) {
        // Verify we're actually authenticated by checking for login form
        const emailInput = await page.$('#email');
        if (!emailInput) {
          console.log(`[${this.originCode}] ✅ Already authenticated (on ${initialUrl}, no login form)`);
          return true;
        }
      }

      // Navigate to login page to check authentication
      if (!initialUrl.includes('/login')) {
        console.log(`[${this.originCode}] Navigating to login page for auth check...`);
        await page.goto(loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
      }
      
      // Wait for Angular to load (RETROTRAC is an Angular app)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Log HTML after page loads
      await this.logHtml(page, 'retrotrac-auth-check');

      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`[${this.originCode}] Navigation completed`);
      console.log(`[${this.originCode}]   - Final URL: ${currentUrl}`);
      console.log(`[${this.originCode}]   - Page title: ${pageTitle}`);

      // Check for login form elements
      // RETROTRAC uses #email and #password on login page (verified via browser testing)
      const emailInput = await page.$('#email');
      const passwordInput = await page.$('#password');
      const loginButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase();
          return text.includes('ingresar') || text.includes('login') || text.includes('entrar');
        });
      });

      // Check if we're on login page
      const isOnLoginPage = currentUrl.includes('/login');
      
      console.log(`[${this.originCode}] Authentication check results:`);
      console.log(`[${this.originCode}]   - On login page: ${isOnLoginPage}`);
      console.log(`[${this.originCode}]   - Email input found: ${!!emailInput}`);
      console.log(`[${this.originCode}]   - Password input found: ${!!passwordInput}`);
      console.log(`[${this.originCode}]   - Login button found: ${!!loginButton}`);

      // If we're on login page AND have login form elements, we're NOT authenticated
      if (isOnLoginPage && emailInput && passwordInput) {
        console.log(`[${this.originCode}] ❌ Not authenticated (on login page with login form)`);
        await this.logHtml(page, 'retrotrac-login-page');
        return false;
      }

      // If we're not on login page and don't have login form, we're authenticated
      if (!isOnLoginPage && !emailInput && !passwordInput) {
        console.log(`[${this.originCode}] ✅ Already authenticated (not on login page, no login form)`);
        return true;
      }

      // If we have login form elements but not on login page, navigate to login
      if (emailInput && passwordInput && !isOnLoginPage) {
        console.log(`[${this.originCode}] ❌ Not authenticated (login form found on non-login page)`);
        await page.goto(loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        await this.logHtml(page, 'retrotrac-login-page');
        return false;
      }

      // Default: if no email input found, assume authenticated
      console.log(`[${this.originCode}] ✅ Already authenticated (no email input found)`);
      return true;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during auth check:`, error);
      return false;
    }
  }

  /**
   * Override scrape method to add HTML logging at different steps
   * Similar to PartequiposHandler - uses base implementation with HTML logging
   */
  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    console.log(`[${this.originCode}] Starting scrape for reference: ${reference}`);
    
    // Step 1: Initial page state
    const initialUrl = page.url();
    console.log(`[${this.originCode}] Initial URL: ${initialUrl}`);
    await this.logHtml(page, 'retrotrac-step1-initial');

    // Use base scrape implementation (handles authentication check and step execution)
    const content = await super.scrape(page, config, reference);
    
    // Final step: Log final state
    await this.logHtml(page, `retrotrac-final-${reference}`);
    
    return content;
  }
}

