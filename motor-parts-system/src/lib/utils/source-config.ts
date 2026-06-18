import { ClientSourceConfig } from '@/types';

/**
 * Get list of enabled source origin codes from client configuration
 * @param sourceConfig - Client source configuration
 * @returns Array of enabled origin codes
 */
export function getEnabledSources(sourceConfig: ClientSourceConfig | null): string[] {
  if (!sourceConfig || !sourceConfig.sources) {
    return [];
  }
  return sourceConfig.sources
    .filter((s) => s.enabled)
    .map((s) => s.originCode);
}

/**
 * Get profit value (divisor) for a specific source
 * @param sourceConfig - Client source configuration
 * @param originCode - Source origin code
 * @returns Profit divisor (default: 0.6 if not found or not enabled)
 */
export function getProfitValueForSource(
  sourceConfig: ClientSourceConfig | null,
  originCode: string
): number {
  if (!sourceConfig || !sourceConfig.sources) {
    return 0.6; // Default profit divisor (equivalent to 40% profit margin)
  }
  const source = sourceConfig.sources.find(
    (s) => s.originCode === originCode && s.enabled
  );
  return source?.profitValue ?? 0.6; // Default 0.6 (price / 0.6)
}

/**
 * Check if a source is enabled for a client
 * @param sourceConfig - Client source configuration
 * @param originCode - Source origin code
 * @returns True if source is enabled, false otherwise
 */
export function isSourceEnabled(
  sourceConfig: ClientSourceConfig | null,
  originCode: string
): boolean {
  if (!sourceConfig || !sourceConfig.sources) {
    return false;
  }
  return sourceConfig.sources.some(
    (s) => s.originCode === originCode && s.enabled
  );
}

/**
 * Get default source configuration (all sources enabled with 0.6 profit divisor)
 * @param availableSources - Array of available source origin codes
 * @returns Default client source configuration
 */
export function getDefaultSourceConfig(
  availableSources: Array<{ originCode: string; name: string }>
): ClientSourceConfig {
  return {
    sources: availableSources.map((source) => ({
      originCode: source.originCode,
      enabled: true,
      profitValue: 0.6, // Default 0.6 divisor (price / 0.6)
    })),
  };
}

