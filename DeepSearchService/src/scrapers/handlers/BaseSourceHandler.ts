import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { executeSteps } from '../step-executor';
import { ISourceHandler } from './interfaces/ISourceHandler';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Base implementation of ISourceHandler
 * Provides common functionality that most sources can use
 */
export abstract class BaseSourceHandler implements ISourceHandler {
  abstract readonly originCode: string;

  /**
   * Default authentication check - can be overridden by subclasses
   */
  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    // Default: navigate to login URL and check for password field
    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const passwordField = await page.$('input[type="password"], #password, input[name="password"]');
      return !passwordField; // If no password field, we're logged in
    } catch (error) {
      console.warn(`[${this.originCode}] Auth check failed:`, error);
      return false;
    }
  }

  /**
   * Default scrape implementation - can be overridden by subclasses
   */
  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    const placeholders: Record<string, string> = {
      username: config.loginUsername || '',
      password: config.loginPassword || '',
      reference: reference,
    };

    // Check authentication
    let isAuthenticated = false;
    if (config.loginUrl) {
      console.log(`[${this.originCode}] Checking authentication...`);
      isAuthenticated = await this.checkAuthentication(page, config.loginUrl);
    }

    // Execute login steps if needed
    if (config.requiresLogin && config.loginSteps && config.loginSteps.length > 0) {
      if (!isAuthenticated) {
        console.log(`[${this.originCode}] Not authenticated, executing login steps...`);
        await executeSteps(page, config.loginSteps, placeholders, false, this.originCode);
      } else {
        console.log(`[${this.originCode}] Already authenticated, skipping login steps`);
        await executeSteps(page, config.loginSteps, placeholders, true, this.originCode);
      }
    }

    // Post-login navigation if needed
    if (this.postLoginNavigation) {
      await this.postLoginNavigation(page, config);
    }

    // Wait for content to load
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector, { timeout: config.timeoutMs || 30000 });
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Get page content
    const content = await page.content();
    
    // Save HTML to file for debugging
    try {
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.originCode.toLowerCase()}-search-result-${reference}-${timestamp}.html`;
      const filepath = path.join(debugDir, filename);
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`[${this.originCode}] 📄 Saved search result HTML to: ${filepath}`);
      console.log(`[${this.originCode}] 📄 HTML length: ${content.length} characters`);
    } catch (error: any) {
      console.warn(`[${this.originCode}] ⚠️ Failed to save search result HTML: ${error.message}`);
    }
    
    return content;
  }

  /**
   * Optional post-login navigation - override in subclasses if needed
   */
  postLoginNavigation?(page: Page, config: EndpointConfig): Promise<void>;
}

