import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { BaseSourceHandler } from './BaseSourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * PARTEQUIPOS-specific handler
 * Handles custom authentication check for PARTEQUIPOS (Magento-based e-commerce)
 * All handlers return HTML content that parsers convert to standardized Product structure
 */
export class PartequiposHandler extends BaseSourceHandler {
  readonly originCode = 'PARTEQUIPOS';

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
      // Navigate to login page to check authentication
      // PARTEQUIPOS uses Magento, login URL is /customer/account/login/
      if (!initialUrl.includes('/customer/account/login') && !initialUrl.includes('/login')) {
        console.log(`[${this.originCode}] Navigating to login page for auth check...`);
        await page.goto(loginUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });
        
        // Wait for Magento to load
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        console.log(`[${this.originCode}] Already on login page, waiting for Magento to load...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`[${this.originCode}] Navigation completed`);
      console.log(`[${this.originCode}]   - Final URL: ${currentUrl}`);
      console.log(`[${this.originCode}]   - Page title: ${pageTitle}`);

      // Log HTML after navigation
      await this.logHtml(page, 'partequipos-auth-check');

      // Check for login form elements
      // PARTEQUIPOS (Magento) uses #email, #pass, #send2
      const emailInput = await page.$('#email, input[type="email"], input[name="login[username]"], input[name="email"]');
      const passwordInput = await page.$('#pass, input[type="password"], input[name="login[password]"]');
      const loginButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = (btn.textContent || btn.innerText || '').toLowerCase();
          return text.includes('iniciar sesión') || 
                 text.includes('iniciar sesion') || 
                 text.includes('login') ||
                 btn.id === 'send2';
        });
      });

      // Check for logged-in indicators (Magento dashboard)
      const accountDashboard = await page.$('.dashboard, .account-dashboard, .customer-account');
      const welcomeMessage = await page.$('.welcome-msg, .welcome, [class*="welcome"]');
      const logoutLink = await page.$('a[href*="logout"], a[title*="Logout" i], a[title*="Cerrar" i]');

      // Check if we're on login page
      const isOnLoginPage = currentUrl.includes('/customer/account/login') || currentUrl.includes('/login');
      
      console.log(`[${this.originCode}] Authentication check results:`);
      console.log(`[${this.originCode}]   - On login page: ${isOnLoginPage}`);
      console.log(`[${this.originCode}]   - Email input found: ${!!emailInput}`);
      console.log(`[${this.originCode}]   - Password input found: ${!!passwordInput}`);
      console.log(`[${this.originCode}]   - Login button found: ${!!loginButton}`);
      console.log(`[${this.originCode}]   - Account dashboard found: ${!!accountDashboard}`);
      console.log(`[${this.originCode}]   - Welcome message found: ${!!welcomeMessage}`);
      console.log(`[${this.originCode}]   - Logout link found: ${!!logoutLink}`);

      // If we have account dashboard or logout link, we're authenticated
      if (accountDashboard || logoutLink) {
        console.log(`[${this.originCode}] ✅ Already authenticated (account dashboard or logout link found)`);
        return true;
      }

      // If we're on login page and have login form, we're not authenticated
      if (isOnLoginPage && emailInput && passwordInput) {
        console.log(`[${this.originCode}] ❌ Not authenticated (login form found on login page)`);
        // Log HTML when authentication is required
        await this.logHtml(page, 'partequipos-login-page');
        return false;
      }

      // If we're not on login page and don't have login form, we're authenticated
      if (!isOnLoginPage && !emailInput && !passwordInput) {
        console.log(`[${this.originCode}] ✅ Already authenticated (no login form, not on login page)`);
        return true;
      }

      // Default: if no email input found, assume authenticated
      if (!emailInput) {
        console.log(`[${this.originCode}] ✅ Already authenticated (no email input found)`);
        return true;
      }

      // If email input exists, we need to login
      console.log(`[${this.originCode}] ❌ Not authenticated (email input found)`);
      // Log HTML when authentication is required
      await this.logHtml(page, 'partequipos-login-page');
      return false;
    } catch (error: any) {
      console.error(`[${this.originCode}] Error during auth check:`, error);
      return false;
    }
  }
}
