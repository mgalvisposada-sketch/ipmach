import * as fs from 'fs';
import * as path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');
const CACHE_FILE_PREFIX = 'importadora-gran-andina';

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get cache file path for a given origin
 */
function getCacheFilePath(originCode: string): string {
  ensureCacheDir();
  const fileName = `${CACHE_FILE_PREFIX}-${originCode.toLowerCase()}.json`;
  return path.join(CACHE_DIR, fileName);
}

/**
 * Check if cache is from today
 */
function isCacheFromToday(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stats = fs.statSync(filePath);
  const cacheDate = new Date(stats.mtime);
  const today = new Date();

  return (
    cacheDate.getFullYear() === today.getFullYear() &&
    cacheDate.getMonth() === today.getMonth() &&
    cacheDate.getDate() === today.getDate()
  );
}

/**
 * Get cached data for an origin
 */
export function getCachedData<T>(originCode: string): T | null {
  const filePath = getCacheFilePath(originCode);
  
  if (!isCacheFromToday(filePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.data as T;
  } catch (error: any) {
    console.warn(`⚠️ [Cache] Failed to read cache for ${originCode}:`, error.message);
    return null;
  }
}

/**
 * Store data in cache
 */
export function setCachedData<T>(originCode: string, data: T): void {
  const filePath = getCacheFilePath(originCode);
  
  try {
    const cacheData = {
      originCode,
      cachedAt: new Date().toISOString(),
      data,
    };
    
    fs.writeFileSync(filePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    console.log(`✅ [Cache] Cached data for ${originCode} (${filePath})`);
  } catch (error: any) {
    console.error(`❌ [Cache] Failed to write cache for ${originCode}:`, error.message);
  }
}

/**
 * Check if cache needs refresh (not from today)
 */
export function needsCacheRefresh(originCode: string): boolean {
  const filePath = getCacheFilePath(originCode);
  return !isCacheFromToday(filePath);
}

