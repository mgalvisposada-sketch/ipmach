/**
 * Type definitions for worker thread messages
 * Used for communication between main thread and scraper worker
 */

export interface ScrapeRequest {
  type: 'scrape';
  id: string;
  config: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
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
    originCode?: string;
    loginSteps?: any[];
    reference?: string;
  };
}

export interface ScrapeResponse {
  type: 'scrape';
  id: string;
  success: boolean;
  content?: string;
  error?: string;
}

export interface InitRequest {
  type: 'init';
  id: string;
}

export interface InitResponse {
  type: 'init';
  id: string;
  success: boolean;
  error?: string;
}

export interface CloseRequest {
  type: 'close';
  id: string;
}

export interface CloseResponse {
  type: 'close';
  id: string;
  success: boolean;
  error?: string;
}

export type WorkerRequest = ScrapeRequest | InitRequest | CloseRequest;
export type WorkerResponse = ScrapeResponse | InitResponse | CloseResponse;

