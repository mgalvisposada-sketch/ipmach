import { Page } from 'puppeteer';
import { BaseSourceHandler } from './BaseSourceHandler';

/**
 * Default handler for sources without custom logic
 * Uses base implementation for all operations
 */
export class DefaultSourceHandler extends BaseSourceHandler {
  readonly originCode: string;

  constructor(originCode: string) {
    super();
    this.originCode = originCode;
  }
}

