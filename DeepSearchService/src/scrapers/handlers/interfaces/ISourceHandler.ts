import { Page } from 'puppeteer';
import { EndpointConfig } from '../../types';

/**
 * Interface for source-specific scraping handlers
 * 
 * All handlers implement this interface to provide custom logic per source.
 * Each handler returns HTML content that parsers convert to standardized Product structure.
 * 
 * The Product structure is defined in parsers/types.ts:
 * - reference: string (required)
 * - description?: string
 * - price?: number (COP)
 * - stock?: number
 * - hasStock: boolean (required)
 * - location?: string
 * - imageUrl?: string
 * - link?: string
 * - brand?: string
 * - origin: string (required)
 * 
 * This ensures all sources return the same product structure regardless of their
 * website's internal format.
 */
export interface ISourceHandler {
  /**
   * Origin code this handler manages (e.g., 'DONSSON', 'AGROCOSTA', 'GECOLSA')
   */
  readonly originCode: string;

  /**
   * Check if user is already authenticated
   * @param page - Puppeteer page instance
   * @param loginUrl - Login URL for the source
   * @returns true if authenticated, false otherwise
   */
  checkAuthentication(page: Page, loginUrl: string): Promise<boolean>;

  /**
   * Execute the scraping flow (login + search)
   * Returns HTML content that will be parsed into standardized Product structure
   * @param page - Puppeteer page instance
   * @param config - Endpoint configuration
   * @param reference - Search reference/term
   * @returns HTML content after scraping (will be parsed to Product[] by parsers)
   */
  scrape(page: Page, config: EndpointConfig, reference: string): Promise<string>;

  /**
   * Handle post-login navigation or setup
   * Called after successful login to navigate to search page if needed
   * @param page - Puppeteer page instance
   * @param config - Endpoint configuration
   */
  postLoginNavigation?(page: Page, config: EndpointConfig): Promise<void>;

  /**
   * Get source-specific browser options
   * @returns Browser launch options or undefined for defaults
   */
  getBrowserOptions?(): any;
}

