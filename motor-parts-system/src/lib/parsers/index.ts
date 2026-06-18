// Only export types and interfaces - avoid static exports of parser classes
// Parser classes should be imported dynamically to avoid build-time analysis
export type { IParser } from './interfaces/IParser';
export { ParserFactory } from './ParserFactory';
export type { ParseResult, Product, ParseError } from './types';
export type { JsonParserConfig } from './JsonParser';

