/**
 * Configuration for scraping an endpoint
 */
export interface ScrapeConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeout: number;
  waitForSelector?: string;
  retryAttempts?: number;
  requiresLogin?: boolean;
  loginUrl?: string;
  loginUsername?: string;
  loginPassword?: string;
  loginFormSelector?: string;
  usernameField?: string;
  passwordField?: string;
  cookies?: string;
  originCode?: string; // Origin code for context caching (e.g., 'SERVITRACTOR', 'PARTEQUIPOS')
  loginSteps?: Array<{
    type: 'goto' | 'fill' | 'click' | 'wait' | 'select' | 'press' | 'navigate' | 'log-html' | 'evaluate';
    selector?: string;
    value?: string;
    url?: string;
    script?: string;
    options?: {
      delay?: number;
      timeout?: number;
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'networkidle0' | 'networkidle2';
      button?: 'left' | 'right' | 'middle';
      key?: string;
      filename?: string;
    };
  }>; // Combined login+search steps. Use {{username}}, {{password}}, and {{reference}} placeholders
  reference?: string; // Reference to search for (used in loginSteps with {{reference}} placeholder)
}

