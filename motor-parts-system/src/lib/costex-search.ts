import { normalizeReference } from '@/lib/analytics/conversion-calculator';
import { prisma } from '@/lib/prisma';

const TARGET_LOCATION_CODES = ['01', '05'] as const;

export type CostexSearchSuccess = {
    success: true;
    data: Record<string, unknown>[];
    source: 'costex';
};

export type CostexSearchFailure = {
    success: false;
    error: string;
    status: number;
    found?: boolean;
};

export type CostexSearchResult = CostexSearchSuccess | CostexSearchFailure;

function findLocationByCode(
    allLocations: Record<string, unknown>,
    code: string
): { key: string; data: Record<string, unknown> } | null {
    const padded = code.padStart(2, '0');
    const keyCand = `Location${padded}`;
    if (allLocations[keyCand]) {
        return { key: keyCand, data: allLocations[keyCand] as Record<string, unknown> };
    }
    for (const [key, loc] of Object.entries(allLocations)) {
        const row = loc as Record<string, unknown>;
        const locCode = typeof row?.LocCode === 'string' ? row.LocCode.trim() : '';
        if (locCode === padded) {
            return { key, data: row };
        }
    }
    return null;
}

function resolveProfitMultiplier(
    configs: Record<string, { value: number }>,
    clientType: number | undefined
): { profitPercentage: number; clientTypeName: string } | CostexSearchFailure {
    let clientTypeName = 'A';

    const readMultiplierOrError = (key: string, label: string): number | null => {
        const val = configs[key]?.value;
        if (typeof val !== 'number' || !(val > 0)) {
            return null;
        }
        clientTypeName = label;
        return val;
    };

    if (clientType !== undefined) {
        let requiredKey = 'A';
        let label = 'A';
        switch (clientType) {
            case 14:
                requiredKey = 'CIPARCOL';
                label = 'CIPARCOL';
                break;
            case 15:
            case 4:
                requiredKey = 'PREMIUM';
                label = 'PREMIUM';
                break;
            case 16:
            case 3:
                requiredKey = 'AA';
                label = 'AA';
                break;
            case 17:
            case 2:
                requiredKey = 'A';
                label = 'A';
                break;
            case 6:
                requiredKey = 'DISTRIBUIDOR';
                label = 'DISTRIBUIDOR';
                break;
            case 5:
                requiredKey = 'ALMACEN';
                label = 'ALMACEN';
                break;
            default:
                requiredKey = 'A';
                label = 'A';
                break;
        }
        const mult = readMultiplierOrError(requiredKey, label);
        if (mult === null) {
            return {
                success: false,
                error: `Configuration value missing or invalid for client type '${requiredKey}'`,
                status: 500,
            };
        }
        return { profitPercentage: mult, clientTypeName };
    }

    const mult = readMultiplierOrError('A', 'A');
    if (mult === null) {
        return {
            success: false,
            error: "Configuration value missing or invalid for client type 'A'",
            status: 500,
        };
    }
    return { profitPercentage: mult, clientTypeName };
}

export async function getActiveConfigurations(): Promise<
    Record<string, { value: number; description: string | null; category: string }>
> {
    const configurations = await prisma.configuration.findMany({
        where: { isActive: true },
        orderBy: { category: 'asc' },
    });

    return configurations.reduce(
        (acc, config) => {
            acc[config.key] = {
                value: Number(config.value),
                description: config.description,
                category: config.category,
            };
            return acc;
        },
        {} as Record<string, { value: number; description: string | null; category: string }>
    );
}

export async function searchCostexPart(
    rawPartNumber: string,
    clientType?: number
): Promise<CostexSearchResult> {
    const partNumber = normalizeReference(String(rawPartNumber).toUpperCase().trim());

    const costexApiUrl = process.env.COSTEX_API_URL;
    const accessKey = process.env.COSTEX_ACCESS_KEY;
    const userId = process.env.COSTEX_USER_ID;
    const password = process.env.COSTEX_PASSWORD;
    const customer = process.env.COSTEX_CUSTOMER;

    if (!costexApiUrl || !accessKey || !userId || !password || !customer) {
        console.error('Missing Costex API configuration');
        return {
            success: false,
            error: 'External API configuration missing',
            status: 500,
        };
    }

    const formData = new URLSearchParams();
    formData.append('format', 'json');
    formData.append('acckey', accessKey);
    formData.append('userid', userId);
    formData.append('passw', password);
    formData.append('cust', customer);
    formData.append('partn', partNumber);
    formData.append('branch', '00');

    const response = await fetch(costexApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Cookie: 'PHPSESSID=uaodj7qancba110487omvsrppc4or48p',
        },
        body: formData.toString(),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[COSTEX-API] Request failed for part "${partNumber}":`, {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorBody.substring(0, 500),
        });
        return {
            success: false,
            error: 'External API request failed',
            status: response.status,
        };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const allLocations = (data.Locations as Record<string, unknown>) || {};

    console.log(`[COSTEX-API] Received data for part "${partNumber}":`, {
        found: !!data.strPartNumber,
        locationsCount: Object.keys(allLocations).length,
        locations: Object.keys(allLocations),
    });

    const resolved: Array<{ locationKey: string; locCode: string; row: Record<string, unknown> }> = [];
    for (const locCode of TARGET_LOCATION_CODES) {
        const hit = findLocationByCode(allLocations, locCode);
        if (hit) {
            resolved.push({ locationKey: hit.key, locCode, row: hit.data });
        }
    }

    if (resolved.length === 0) {
        const availableLocations = Object.keys(allLocations);
        console.warn(
            `⚠️ [COSTEX] No Location01 or Location05 for part "${partNumber}". Available: ${
                availableLocations.length ? availableLocations.join(', ') : 'None'
            }`,
            { rawData: data }
        );
        return {
            success: false,
            error: 'Part not available at Location01 or Location05',
            status: 404,
            found: false,
        };
    }

    const configs = await getActiveConfigurations();
    const profitResult = resolveProfitMultiplier(configs, clientType);
    if ('error' in profitResult) {
        return profitResult;
    }
    const { profitPercentage, clientTypeName } = profitResult;

    const profitFraction = profitPercentage <= 1 ? profitPercentage : profitPercentage / 100;
    const safeProfitFraction = profitFraction > 0 ? profitFraction : 0.75;

    console.log(
        `💰 [COSTEX] clientType=${clientType ?? 'none (default A)'}, clientTypeName=${clientTypeName}, profitFraction=${safeProfitFraction.toFixed(4)}`
    );

    const rows: Record<string, unknown>[] = [];

    for (const { locationKey, locCode, row } of resolved) {
        const rawCustPrice = (row.CustPrice as string | undefined) ?? '';
        const basePriceUSD = parseFloat((rawCustPrice || '0').replace(/,/g, ''));
        const totalStock = parseInt(String(row.NetQtyStock ?? '0'), 10) || 0;
        const locationsScoped = { [locationKey]: row };
        const branchName = typeof row.BranchName === 'string' ? row.BranchName.trim() : '';
        const precioVentaUSD = basePriceUSD / safeProfitFraction;

        console.log(
            `✅ [COSTEX-LOC${locCode}] CustPrice="${rawCustPrice}" → basePriceUSD=$${basePriceUSD.toFixed(2)}, stock=${totalStock}, sellPriceUSD=$${precioVentaUSD.toFixed(2)}, ${branchName || locationKey}`
        );

        rows.push({
            partNumber: (data.strPartNumber as string) || partNumber,
            description: (data.strDescrip1 as string) || '',
            listPriceUSD: parseFloat(String(data.dblListPrice || '0').replace(/,/g, '')),
            listPriceCOP: 0,
            weight: {
                pounds: parseFloat(String(data.intWeigthPnd || '0')),
                kilograms: parseFloat(String(data.dblWeigthKgs || '0')),
            },
            dimensions: {
                length: parseFloat(String(data.dblLengthIn || '0')),
                width: parseFloat(String(data.dblWidthIn || '0')),
                height: parseFloat(String(data.dblHeightIn || '0')),
                volume: parseFloat(String(data.dblVolumeIn3 || '0')),
            },
            category: {
                major: (data.strMajorDsc as string) || '',
                category: (data.strCategoryDs as string) || '',
                subCategory: (data.strSbCatDsc as string) || '',
                minor: (data.strMinorDsc as string) || '',
            },
            imageUrl: (data.strFlgCtpPho as string) || '',
            locations: locationsScoped,
            totalStock,
            baseCostUSD: basePriceUSD,
            minPriceUSD: precioVentaUSD,
            maxPriceUSD: precioVentaUSD,
            minPriceCOP: 0,
            maxPriceCOP: 0,
            sourceLocationCode: locCode,
            sourceLocationName: branchName || `Location ${locCode}`,
            rawData: data,
            calculation: {
                rules: {
                    clientType: clientTypeName,
                    profitPercentage,
                    formula: 'precioVentaUSD = Location.CustPrice / profitFraction',
                },
                inputs: {
                    baseCostUSD: basePriceUSD,
                    profitPercentage,
                    sourceLocationCode: locCode,
                },
                intermediate: {
                    profitFraction: Number(safeProfitFraction.toFixed(4)),
                },
                outputs: {
                    sellPriceUSD: Number(precioVentaUSD.toFixed(2)),
                },
            },
        });
    }

    return {
        success: true,
        data: rows,
        source: 'costex',
    };
}
