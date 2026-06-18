/**
 * Environment variable validation and configuration
 */

export interface EnvironmentConfig {
  port: number;
  nodeEnv: string;
  browserPoolSize: number;
  browserTimeout: number;
  contextExpirationMs: number;
  contextCleanupIntervalMs: number;
  enablePageReuse: boolean;
  apiKey: string;
  nextjsApiOrigin: string;
  allowedIPs?: string[];
  requireHttps: boolean;
  enableIPWhitelist: boolean;
  logSensitiveData: boolean;
  logLevel: string;
  openaiApiKey?: string;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  rateLimitPerOriginMax: number;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  // Allow empty string as valid value, only throw if no value and no default
  if (value === undefined && defaultValue === undefined) {
    // In development, provide a default for API_KEY
    if (key === 'API_KEY' && process.env.NODE_ENV === 'development') {
      return 'dev-api-key';
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value !== undefined ? value : (defaultValue || '');
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const config: EnvironmentConfig = {
  port: getEnvNumber('PORT', 3001),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  browserPoolSize: getEnvNumber('BROWSER_POOL_SIZE', 4),
  browserTimeout: getEnvNumber('BROWSER_TIMEOUT', 60000),
  contextExpirationMs: getEnvNumber('CONTEXT_EXPIRATION_MS', 0), // 0 = never expire
  contextCleanupIntervalMs: getEnvNumber('CONTEXT_CLEANUP_INTERVAL_MS', 0), // 0 = disabled
  enablePageReuse: getEnvBoolean('ENABLE_PAGE_REUSE', true),
  apiKey: getEnvVar('API_KEY', ''),
  nextjsApiOrigin: getEnvVar('NEXTJS_API_ORIGIN', '*'),
  allowedIPs: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : undefined,
  requireHttps: getEnvBoolean('REQUIRE_HTTPS', true),
  enableIPWhitelist: getEnvBoolean('ENABLE_IP_WHITELIST', false),
  logSensitiveData: getEnvBoolean('LOG_SENSITIVE_DATA', false),
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  openaiApiKey: process.env.OPENAI_API_KEY,
  rateLimitMaxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 60000),
  rateLimitPerOriginMax: getEnvNumber('RATE_LIMIT_PER_ORIGIN_MAX', 10),
};

// Validate critical configuration
if (!config.apiKey && config.nodeEnv === 'production') {
  console.warn('⚠️  WARNING: API_KEY not set in production environment');
}

if (config.requireHttps && config.nodeEnv === 'production') {
  console.log('🔒 HTTPS enforcement enabled');
}

