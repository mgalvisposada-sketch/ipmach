import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { executeSteps } from '../step-executor';
import { BaseSourceHandler } from './BaseSourceHandler';

/**
 * AGROCOSTA-specific handler
 * Handles custom authentication check that navigates to search page
 */
export class AgroCostaHandler extends BaseSourceHandler {
  readonly originCode = 'AGROCOSTA';

  async checkAuthentication(page: Page, loginUrl: string): Promise<boolean> {
    console.log(`[${this.originCode}] Auth check starting`);
    console.log(`[${this.originCode}] Navigating to search page to check authentication...`);

    // Navigate to the search page - if not authenticated, it will redirect to login.php automatically
    await page.goto('https://agro-costa.com/consulta/consulta_inventario.php', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for any redirects to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the final URL after any redirects
    const currentUrl = page.url();
    console.log(`[${this.originCode}] Final URL after navigation: ${currentUrl}`);

    // Check if we were redirected to the login page
    if (currentUrl.includes('login.php') || currentUrl.includes('/login')) {
      console.log(`[${this.originCode}] ❌ Not authenticated (auto-redirected to login page)`);
      return false;
    }

    // We stayed on the search page - check if the search form exists to confirm
    const buscarButton = await page.$('button[name="buscar"]');
    const referenciaInput = await page.$('input[name="referencia"][type="text"]');
    const pageContent = await page.content();
    const hasWelcomeText = pageContent.includes('Bienvenido') || pageContent.includes('bienvenido');

    console.log(`[${this.originCode}] Search form check:`);
    console.log(`[${this.originCode}]   - Buscar button: ${!!buscarButton}`);
    console.log(`[${this.originCode}]   - Reference input: ${!!referenciaInput}`);
    console.log(`[${this.originCode}]   - Welcome text: ${hasWelcomeText}`);

    // If we're on the search page AND have the search form, we're authenticated
    if (currentUrl.includes('consulta_inventario') && (buscarButton || referenciaInput || hasWelcomeText)) {
      console.log(`[${this.originCode}] ✅ Already authenticated (search page loaded successfully)`);
      return true;
    }

    // Edge case: on search page but can't find search form
    console.log(`[${this.originCode}] ⚠️  On search page but form not found - assuming not authenticated`);
    return false;
  }

  async scrape(page: Page, config: EndpointConfig, reference: string): Promise<string> {
    // AGROCOSTA has special handling - checkAuthentication already navigates to search page
    // So we need to handle the flow differently
    const placeholders: Record<string, string> = {
      username: config.loginUsername || '',
      password: config.loginPassword || '',
      reference: reference,
    };

    // Check authentication (this already navigates to search page for AGROCOSTA)
    let isAuthenticated = false;
    if (config.loginUrl) {
      isAuthenticated = await this.checkAuthentication(page, config.loginUrl);
    }

    if (config.requiresLogin && config.loginSteps && config.loginSteps.length > 0) {
      if (!isAuthenticated) {
        console.log(`[${this.originCode}] Not authenticated, executing login steps...`);
        await executeSteps(page, config.loginSteps!, placeholders, false, this.originCode);
      } else {
        console.log(`[${this.originCode}] Already authenticated, checking if still on search page...`);
        
        // Double-check we're still on the search page
        const currentUrl = page.url();
        const isOnSearchPage = currentUrl.includes('consulta_inventario');
        
        const referenciaInput = await page.$('input[name="referencia"][type="text"]');
        const hasSearchForm = !!referenciaInput;
        
        const pageContent = await page.content();
        const hasWelcomeText = pageContent.includes('Bienvenido') || pageContent.includes('bienvenido');
        
        if (!hasSearchForm || !isOnSearchPage) {
          console.warn(`[${this.originCode}] Session may have expired, attempting login`);
          await executeSteps(page, config.loginSteps!, placeholders, false, this.originCode);
        } else {
          console.log(`[${this.originCode}] Confirmed on search page, executing search steps only`);
          await executeSteps(page, config.loginSteps!, placeholders, true, this.originCode);
        }
      }
    }

    // Wait for content
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector, { timeout: config.timeoutMs || 30000 });
    } else {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return await page.content();
  }
}

