import { IParser } from './interfaces/IParser';
import { ParseResult, Product } from './types';
import * as cheerio from 'cheerio';

/**
 * Abstract base class providing common functionality for all parsers
 * Extend this class to create origin-specific parsers
 */
export abstract class BaseParser implements IParser {
  abstract readonly originCode: string;
  abstract readonly originName: string;

  /**
   * Parse method - must be implemented by each origin-specific parser
   */
  abstract parse(content: string | object, searchTerm: string): Promise<ParseResult>;

  /**
   * Default implementation - can be overridden by child classes
   * Checks if content contains origin-specific markers
   */
  canParse(content: string | object): boolean {
    // Default: accept any content if not overridden
    // Child classes should implement specific detection logic
    return true;
  }

  /**
   * Helper: Load HTML into Cheerio for parsing
   */
  protected loadCheerio(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Helper: Extract text from selector (first match only)
   */
  protected extractText($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).first().text().trim();
  }

  /**
   * Helper: Extract all text from multiple elements
   */
  protected extractAllText($: cheerio.CheerioAPI, selector: string): string[] {
    const texts: string[] = [];
    $(selector).each((_, element) => {
      const text = $(element).text().trim();
      if (text) texts.push(text);
    });
    return texts;
  }

  /**
   * Helper: Extract number from text (removes currency symbols, commas, spaces)
   */
  protected extractNumber(text: string): number {
    if (!text) return 0;
    // Remove currency symbols, commas, spaces, and convert to number
    const cleaned = text.replace(/[^\d.,-]/g, '').replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Helper: Normalize reference (uppercase, trim, remove extra spaces)
   */
  protected normalizeReference(ref: string): string {
    return ref.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  /**
   * Helper: Extract attribute value from selector
   */
  protected extractAttribute($: cheerio.CheerioAPI, selector: string, attribute: string): string {
    return $(selector).first().attr(attribute) || '';
  }

  /**
   * Helper: Create empty result for when no products found
   */
  protected emptyResult(searchTerm: string): ParseResult {
    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products: [],
      metadata: {
        totalFound: 0,
      },
    };
  }

  /**
   * Helper: Create product object with standard structure
   */
  protected createProduct(data: Partial<Product> & { reference: string; origin: string; hasStock: boolean }): Product {
    return {
      reference: this.normalizeReference(data.reference),
      description: data.description,
      price: data.price,
      stock: data.stock,
      hasStock: data.hasStock,
      location: data.location,
      imageUrl: data.imageUrl,
      link: data.link,
      brand: data.brand,
      origin: data.origin,
      rawData: data.rawData,
    };
  }
}

