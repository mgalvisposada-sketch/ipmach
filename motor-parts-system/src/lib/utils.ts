import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'COP'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount)
}

export function formatCurrencyWithSymbol(amount: number, currency: string = 'COP'): string {
    const symbol = currency === 'USD' ? '$' : currency === 'COP' ? '$' : currency;
    return `${symbol}${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

// Simple USD to COP conversion (you can replace this with a real API call)
export function convertUSDToCOP(usdAmount: number, exchangeRate: number = 4100): number {
    return Math.round(usdAmount * exchangeRate);
}

// Get current USD to COP exchange rate using free currency APIs
// Priority order:
// 1. CurrencyFreaks (if API key provided) - 1,000 requests/month
// 2. ExchangeRate-API v6 (if API key provided) - 1,500 requests/month
// 3. ExchangeRate.host (no API key) - 100 requests/month
// 4. Hardcoded fallback - 4100
export async function getUSDToCOPRate(): Promise<number> {
    const apiKey = process.env.CURRENCY_API_KEY;

    // Try CurrencyFreaks first if API key is available (1,000 requests/month)
    if (apiKey) {
        try {
            const currencyFreaksUrl = `https://api.currencyfreaks.com/latest?apikey=${apiKey}&symbols=COP&base=USD`;
            const response = await fetch(currencyFreaksUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.rates && data.rates.COP) {
                    const rate = data.rates.COP;
                    console.log(`✅ [CURRENCY] Successfully fetched USD to COP rate: ${rate} from CurrencyFreaks`);
                    return rate;
                }
            }
        } catch (error) {
            console.error('❌ [CURRENCY] Error fetching from CurrencyFreaks:', error);
        }

        // Try ExchangeRate-API v6 with API key (1,500 requests/month)
        try {
            console.log('🔄 [CURRENCY] Trying ExchangeRate-API v6 with API key');
            const exchangeRateApiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
            console.log('🔄 [CURRENCY] ExchangeRate-API v6 URL:', exchangeRateApiUrl);
            const response = await fetch(exchangeRateApiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (response.ok) {
                const data = await response.json();
                // ExchangeRate-API v6 uses 'conversion_rates' in response
                const copRate = data.conversion_rates?.COP || data.rates?.COP;
                if (copRate) {
                    console.log(`✅ [CURRENCY] Successfully fetched USD to COP rate: ${copRate} from ExchangeRate-API v6`);
                    return copRate;
                }
            }
        } catch (error) {
            console.error('❌ [CURRENCY] Error fetching from ExchangeRate-API v6:', error);
        }
    }

    // Fallback: ExchangeRate.host (no API key required, 100 requests/month)
    try {
        console.log('🔄 [CURRENCY] Trying ExchangeRate.host (free tier, no API key)');
        const response = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=COP', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.rates && data.rates.COP) {
                const rate = data.rates.COP;
                console.log(`✅ [CURRENCY] Successfully fetched USD to COP rate: ${rate} from ExchangeRate.host`);
                return rate;
            }
        }
    } catch (error) {
        console.error('❌ [CURRENCY] Error fetching from ExchangeRate.host:', error);
    }

    // Final fallback: return approximate rate
    console.warn('⚠️ [CURRENCY] All APIs failed. Using hardcoded fallback rate: 4100');
    return 4100; // Approximate USD to COP rate as fallback
}

export function formatDate(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function formatDateTime(date: Date | string): string {
    const d = new Date(date)
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function generateQuoteId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `Q-${timestamp}-${random}`.toUpperCase()
}

export function validateReferenceCode(reference: string): boolean {
    // Alphanumeric validation for reference codes
    return /^[A-Z0-9]{3,20}$/.test(reference.toUpperCase())
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }
}

export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args)
            inThrottle = true
            setTimeout(() => (inThrottle = false), limit)
        }
    }
}
