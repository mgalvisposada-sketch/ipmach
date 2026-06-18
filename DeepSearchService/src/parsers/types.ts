/**
 * Standardized product data structure returned by all parsers
 */
export interface Product {
  reference: string;        // Part number / SKU (required, normalized)
  description?: string;
  price?: number;           // Price in COP
  stock?: number;          // Available quantity
  hasStock: boolean;       // Required
  location?: string;       // Warehouse/location info
  imageUrl?: string;
  link?: string;           // Original product URL
  brand?: string;
  origin: string;          // Origin code (required)
  rawData?: any;           // Original extracted data for debugging
}

/**
 * Parse result structure returned by all parsers
 */
export interface ParseResult {
  originCode: string;
  originName: string;
  searchTerm: string;
  products: Product[];
  metadata?: {
    totalFound?: number;
    hasMore?: boolean;
    rawResponse?: any;
    error?: string;
    extractedBy?: string; // e.g., 'openai', 'parser'
    fallbackReason?: string;
    cantidadTotal?: number; // For RETROTRAC
    totalPage?: number; // For RETROTRAC
  };
}

/**
 * Error information for parsing failures
 */
export interface ParseError {
  originCode: string;
  originName: string;
  error: string;
  details?: any;
}

