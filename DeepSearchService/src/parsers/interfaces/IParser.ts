import { ParseResult } from '../types';

/**
 * Base interface that all parsers must implement
 * Each origin has its own parser class implementing this interface
 */
export interface IParser {
  /**
   * Unique origin code this parser handles (e.g., "PARTEQUIPOS", "SERVICE2")
   */
  readonly originCode: string;

  /**
   * Human-readable origin name
   */
  readonly originName: string;

  /**
   * Parse HTML/JSON response into standardized format
   * @param content - HTML string or JSON object
   * @param searchTerm - The search term used to find these results
   * @returns Promise resolving to ParseResult with standardized products
   */
  parse(content: string | object, searchTerm: string): Promise<ParseResult>;

  /**
   * Validate if the content structure matches this origin
   * Used for auto-detection when parser type is not specified
   * @param content - HTML string or JSON object
   * @returns true if this parser can handle the content
   */
  canParse(content: string | object): boolean;
}

