/**
 * Main scraper function
 * Creates browser, loads session, delegates to handlers, saves session
 */

import { Page, BrowserContext } from 'puppeteer';
import { EndpointConfig } from './types';
import { getOrCreateBrowser, getOrCreateContext, loadSessionState, saveSessionState } from './browser-manager';
import { SourceHandlerFactory } from './handlers/SourceHandlerFactory';

/**
 * Scrape content using Puppeteer
 * Uses source-specific handlers for custom logic per source
 * Uses browser contexts for better isolation between sources
 */
export async function scrapeWithPuppeteer(
  config: EndpointConfig,
  reference: string
): Promise<string> {
  const originCode = config.originCode;
  let browser: any = null;
  let context: any = null;
  let page: any = null;

  try {
    browser = await getOrCreateBrowser(originCode);
    
    // Use browser context for better isolation (each source gets its own context)
    context = await getOrCreateContext(browser, originCode);
    page = await context.newPage();

    // Ensure page starts fresh - navigate to about:blank to clear any previous state
    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {
      // Ignore errors, page might already be on about:blank
    });

    // Load session state if available
    await loadSessionState(page, originCode);

    // Get source-specific handler
    const handler = SourceHandlerFactory.getHandler(originCode);
    
    console.log(`[Scraper] Using handler: ${handler.originCode}${SourceHandlerFactory.hasHandler(originCode) ? ' (custom)' : ' (default)'}`);

    // Use handler to scrape (handles login, navigation, etc.)
    const content = await handler.scrape(page, config, reference);

    // Save session state
    await saveSessionState(page, originCode);

    return content;
  } catch (error: any) {
    console.error(`[Scraper] Error during scraping for ${originCode}:`, error);
    throw error;
  } finally {
    // Always close page to prevent resource leaks
    if (page) {
      try {
        await page.close().catch((e: any) => {
          console.warn(`[Scraper] Error closing page: ${e.message}`);
        });
      } catch (e: any) {
        console.warn(`[Scraper] Error closing page: ${e.message}`);
      }
    }
  }
}

