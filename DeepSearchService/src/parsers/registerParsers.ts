/**
 * Register all parsers with the ParserFactory
 * This should be called on service startup
 */

import { ParserFactory } from './ParserFactory';
import { AgroCostaParser } from './AgroCostaParser';
import { GecolsaParser } from './GecolsaParser';
import { PartequiposParser } from './PartequiposParser';
import { RetrotracParser } from './RetrotracParser';
import { ServitractorParser } from './ServitractorParser';
import { ImportadoraGranAndinaParser } from './ImportadoraGranAndinaParser';
import { DonssonParser } from './DonssonParser';
import { MontecarloParser } from './MontecarloParser';

/**
 * Register all parsers with the factory
 */
export function registerParsers(): void {
  console.log('[ParserFactory] Registering parsers...');

  // Register all origin-specific parsers
  ParserFactory.registerParser(new AgroCostaParser());
  ParserFactory.registerParser(new GecolsaParser());
  ParserFactory.registerParser(new PartequiposParser());
  ParserFactory.registerParser(new RetrotracParser());
  ParserFactory.registerParser(new ServitractorParser());
  ParserFactory.registerParser(new ImportadoraGranAndinaParser());
  ParserFactory.registerParser(new DonssonParser());
  ParserFactory.registerParser(new MontecarloParser());

  console.log('[ParserFactory] ✅ All parsers registered');
}

