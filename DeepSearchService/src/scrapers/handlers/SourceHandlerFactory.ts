import { ISourceHandler } from './interfaces/ISourceHandler';
import { DonssonHandler } from './DonssonHandler';
import { AgroCostaHandler } from './AgroCostaHandler';
import { GecolsaHandler } from './GecolsaHandler';
import { RetrotracHandler } from './RetrotracHandler';
import { ServitractorHandler } from './ServitractorHandler';
import { MontecarloHandler } from './MontecarloHandler';
import { PartequiposHandler } from './PartequiposHandler';
import { ImportadoraGranAndinaHandler } from './ImportadoraGranAndinaHandler';
import { DefaultSourceHandler } from './DefaultSourceHandler';

/**
 * Factory for creating source-specific handlers
 * Each source can have its own custom handler with specialized logic
 */
export class SourceHandlerFactory {
  private static handlers = new Map<string, ISourceHandler>();

  /**
   * Register a handler for a specific origin code
   */
  static registerHandler(handler: ISourceHandler): void {
    this.handlers.set(handler.originCode, handler);
    console.log(`[SourceHandlerFactory] Registered handler for ${handler.originCode}`);
  }

  /**
   * Get handler for a specific origin code
   * Returns custom handler if registered, otherwise returns default handler
   * Handles case-insensitive matching and common typos
   */
  static getHandler(originCode: string): ISourceHandler {
    // Normalize origin code to uppercase
    const normalizedCode = originCode.toUpperCase();
    
    // Try exact match first
    let handler = this.handlers.get(normalizedCode);
    if (handler) {
      return handler;
    }

    // Handle common typos/variations
    const codeVariations: Record<string, string> = {
      'MOTECARLO': 'MONTECARLO', // Common typo: missing one 'T'
    };
    
    const correctedCode = codeVariations[normalizedCode];
    if (correctedCode) {
      handler = this.handlers.get(correctedCode);
      if (handler) {
        console.log(`[SourceHandlerFactory] Corrected originCode "${normalizedCode}" to "${correctedCode}"`);
        return handler;
      }
    }

    // Return default handler for sources without custom logic
    return new DefaultSourceHandler(originCode);
  }

  /**
   * Initialize all handlers
   * Call this on application startup
   */
  static initialize(): void {
    // Register all custom handlers
    // Each handler implements ISourceHandler interface and returns HTML content
    // that parsers convert to standardized Product structure (see parsers/types.ts)
    this.registerHandler(new DonssonHandler());
    this.registerHandler(new AgroCostaHandler());
    this.registerHandler(new GecolsaHandler());
    this.registerHandler(new RetrotracHandler());
    this.registerHandler(new ServitractorHandler());
    this.registerHandler(new MontecarloHandler());
    this.registerHandler(new PartequiposHandler());
    this.registerHandler(new ImportadoraGranAndinaHandler());

    console.log(`[SourceHandlerFactory] Initialized ${this.handlers.size} custom handlers`);
    console.log(`[SourceHandlerFactory] All handlers implement ISourceHandler and return standardized Product structure`);
  }

  /**
   * Get all registered handlers
   */
  static getAllHandlers(): ISourceHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Check if a handler exists for an origin code
   */
  static hasHandler(originCode: string): boolean {
    return this.handlers.has(originCode);
  }
}


