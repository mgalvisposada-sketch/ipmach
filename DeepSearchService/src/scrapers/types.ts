/**
 * Types and interfaces for scrapers
 */

export interface EndpointConfig {
  originCode: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  requiresLogin: boolean;
  loginUrl: string | null;
  loginUsername: string | null;
  loginPassword: string | null;
  usernameField: string | null;
  passwordField: string | null;
  loginSteps: any[] | null;
  timeoutMs: number;
  retryAttempts: number;
  waitForSelector: string | null;
  parserConfig: any;
  cookies?: string;
}

