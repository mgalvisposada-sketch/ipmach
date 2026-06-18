import { Page } from 'puppeteer';
import { EndpointConfig } from '../types';
import { BaseSourceHandler } from './BaseSourceHandler';

/**
 * IMPORTADORAGRANANDINA-specific handler
 * Note: This source uses direct HTTP fetch instead of Puppeteer (handled in search route)
 * This handler exists for consistency but may not be used
 * All handlers return HTML content that parsers convert to standardized Product structure
 */
export class ImportadoraGranAndinaHandler extends BaseSourceHandler {
  readonly originCode = 'IMPORTADORAGRANANDINA';

  // Uses base implementation - IMPORTADORAGRANANDINA uses direct HTTP fetch
  // This handler is kept for consistency but the route handles it differently
}

