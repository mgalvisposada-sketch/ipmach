import { IParser } from './interfaces/IParser';
import { DeepWebEndpoint } from '@prisma/client';

/**
 * Factory pattern for managing and creating parser instances
 * Registers parsers and routes to the correct parser based on origin code
 */
export class ParserFactory {
  private static parsers = new Map<string, IParser>();

  /**
   * Register a parser for a specific origin code
   */
  static registerParser(parser: IParser): void {
    this.parsers.set(parser.originCode, parser);
  }

  /**
   * Get parser for a specific endpoint
   * @param endpoint - DeepWebEndpoint configuration
   * @returns Parser instance for the endpoint
   */
  static async getParser(endpoint: DeepWebEndpoint): Promise<IParser> {
    // Check if custom parser exists for this origin code
    const existing = this.parsers.get(endpoint.originCode);
    if (existing) {
      return existing;
    }

    // Try to create parser from config if specified
    if (endpoint.parserConfig) {
      const config = endpoint.parserConfig as any;
      if (config.type === 'json') {
        // Use JsonParser for JSON responses - use dynamic import
        const { JsonParser } = await import('./JsonParser');
        return new JsonParser(endpoint.originCode, endpoint.name, config);
      }
    }

    // Default: try to find parser by attempting to parse with registered parsers
    // This will be handled at runtime when content is available
    throw new Error(`No parser registered for origin code: ${endpoint.originCode}`);
  }

  /**
   * Auto-detect parser based on content structure
   * @param content - HTML string or JSON object
   * @param originCode - Origin code hint
   * @returns Parser instance or null if no match
   */
  static detectParser(content: string | object, originCode?: string): IParser | null {
    // First try origin-specific parser if code provided
    if (originCode) {
      const parser = this.parsers.get(originCode);
      if (parser && parser.canParse(content)) {
        return parser;
      }
    }

    // Try each registered parser to see which can handle the content
    for (const parser of Array.from(this.parsers.values())) {
      if (parser.canParse(content)) {
        return parser;
      }
    }

    return null;
  }

  /**
   * Get all registered parsers
   */
  static getAllParsers(): IParser[] {
    return Array.from(this.parsers.values());
  }

  /**
   * Clear all registered parsers (useful for testing)
   */
  static clearParsers(): void {
    this.parsers.clear();
  }
}

