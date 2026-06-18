// Do not export PlaywrightScraper statically to avoid build-time inclusion
// Import it dynamically using: const { PlaywrightScraper } = await import('@/lib/scrapers/PlaywrightScraper');
// ScraperWorker is the recommended way to use Playwright (isolates it in worker thread)
export type { ScrapeConfig } from './ScrapeConfig';

