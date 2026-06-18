import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';

/**
 * Configuration for JSON parser
 */
export interface JsonParserConfig {
  productsPath: string;      // e.g., "data.products" or "items"
  referencePath: string;     // e.g., "partNumber" or "sku"
  pricePath: string;         // e.g., "price" or "cost"
  stockPath: string;         // e.g., "quantity" or "stock"
  descriptionPath?: string;  // e.g., "description" or "name"
  imageUrlPath?: string;     // e.g., "imageUrl" or "image"
  linkPath?: string;         // e.g., "url" or "link"
  brandPath?: string;        // e.g., "brand" or "manufacturer"
  locationPath?: string;     // e.g., "location" or "warehouse"
}

/**
 * Generic JSON parser for endpoints that return JSON responses
 * Uses configuration to navigate JSON structure and extract product data
 */
export class JsonParser extends BaseParser {
  readonly originCode: string;
  readonly originName: string;
  private config: JsonParserConfig;

  constructor(originCode: string, originName: string, config: JsonParserConfig) {
    super();
    this.originCode = originCode;
    this.originName = originName;
    this.config = config;
  }

  canParse(content: string | object): boolean {
    // Can parse if content is a valid JSON object
    if (typeof content === 'object' && !Array.isArray(content) && content !== null) {
      return true;
    }
    // Also try to parse if it's a JSON string
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        return typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null;
      } catch {
        return false;
      }
    }
    return false;
  }

  async parse(content: string | object, searchTerm: string): Promise<ParseResult> {
    // Parse JSON string if needed
    let json: any;
    if (typeof content === 'string') {
      try {
        json = JSON.parse(content);
      } catch (error) {
        return this.emptyResult(searchTerm);
      }
    } else {
      json = content;
    }

    const products: Product[] = [];

    // Navigate JSON using config paths
    const items = this.getNestedValue(json, this.config.productsPath);

    if (!Array.isArray(items)) {
      return this.emptyResult(searchTerm);
    }

    items.forEach((item: any) => {
      const reference = this.getNestedValue(item, this.config.referencePath);
      const priceValue = this.getNestedValue(item, this.config.pricePath);
      const stockValue = this.getNestedValue(item, this.config.stockPath);

      if (!reference) {
        return; // Skip items without reference
      }

      const price = typeof priceValue === 'number' ? priceValue : this.extractNumber(String(priceValue || '0'));
      const stock = typeof stockValue === 'number' ? stockValue : parseInt(String(stockValue || '0'), 10);
      const hasStock = stock > 0;

      products.push(
        this.createProduct({
          reference: String(reference),
          description: this.config.descriptionPath ? this.getNestedValue(item, this.config.descriptionPath) : undefined,
          price,
          stock,
          hasStock,
          location: this.config.locationPath ? this.getNestedValue(item, this.config.locationPath) : undefined,
          imageUrl: this.config.imageUrlPath ? this.getNestedValue(item, this.config.imageUrlPath) : undefined,
          link: this.config.linkPath ? this.getNestedValue(item, this.config.linkPath) : undefined,
          brand: this.config.brandPath ? this.getNestedValue(item, this.config.brandPath) : undefined,
          origin: this.originCode,
          rawData: item,
        })
      );
    });

    return {
      originCode: this.originCode,
      originName: this.originName,
      searchTerm,
      products,
      metadata: {
        totalFound: products.length,
      },
    };
  }

  /**
   * Get nested value from object using dot notation path
   * @param obj - Object to traverse
   * @param path - Dot notation path (e.g., "data.items[0].name")
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return undefined;

    // Handle array notation like "items[0].name"
    const parts = path.split(/[\.\[\]]/).filter(Boolean);

    return parts.reduce((current: any, key: string) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      return current[key];
    }, obj);
  }
}

