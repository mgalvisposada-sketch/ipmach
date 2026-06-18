import { useState, useEffect } from 'react';

interface ConfigurationValue {
    value: number;
    description: string | null;
    category: string;
}

interface ConfigurationMap {
    [key: string]: ConfigurationValue;
}

export function useConfiguration() {
    const [configurations, setConfigurations] = useState<ConfigurationMap>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfigurations = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/config');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch configurations');
                }

                setConfigurations(data.data || {});
            } catch (err) {
                console.error('Error fetching configurations:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchConfigurations();
    }, []);

    const getConfiguration = (key: string): number => {
        return configurations[key]?.value || 0;
    };

    const getConfigurationDescription = (key: string): string | null => {
        return configurations[key]?.description || null;
    };

    const getClientTypeMultiplier = (clientType: string): number => {
        const multiplier = getConfiguration(clientType.toUpperCase());
        return multiplier > 0 ? multiplier : 1.0;
    };

    const getPricingConfig = () => {
        return {
            weightAdjustment: getConfiguration('WEIGHT_ADJUSTMENT'),
            poundsPrice: getConfiguration('POUNDS_PRICE'),
            costAdjustment: getConfiguration('COST_ADJUSTMENT'),
            currencyAdjustment: getConfiguration('CURRENCY_ADJUSTMENT')
        };
    };

    const getClientTypeConfigs = () => {
        return {
            DISTRIBUIDOR: getConfiguration('DISTRIBUIDOR'),
            ALMACEN: getConfiguration('ALMACEN'),
            AA: getConfiguration('AA'),
            A: getConfiguration('A'),
            PREMIUM: getConfiguration('PREMIUM'),
            CIPARCOL: getConfiguration('CIPARCOL')
        };
    };

    return {
        configurations,
        loading,
        error,
        getConfiguration,
        getConfigurationDescription,
        getClientTypeMultiplier,
        getPricingConfig,
        getClientTypeConfigs
    };
}
