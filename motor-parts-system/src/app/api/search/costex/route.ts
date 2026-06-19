import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';

export const dynamic = 'force-dynamic';

const TARGET_LOCATION_CODES = ['01', '05'] as const;

function findLocationByCode(
    allLocations: Record<string, any>,
    code: string
): { key: string; data: any } | null {
    const padded = code.padStart(2, '0');
    const keyCand = `Location${padded}`;
    if (allLocations[keyCand]) {
        return { key: keyCand, data: allLocations[keyCand] };
    }
    for (const [key, loc] of Object.entries(allLocations)) {
        const locCode = typeof loc?.LocCode === 'string' ? loc.LocCode.trim() : '';
        if (locCode === padded) {
            return { key, data: loc };
        }
    }
    return null;
}

function resolveProfitMultiplier(
    configs: Record<string, any>,
    clientType: number | undefined
): { profitPercentage: number; clientTypeName: string } | NextResponse {
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
        let requiredKey = '';
        let label = '';
        switch (clientType) {
            case 14:
                requiredKey = 'CIPARCOL';
                label = 'CIPARCOL';
                break;
            case 15:
                requiredKey = 'PREMIUM';
                label = 'PREMIUM';
                break;
            case 16:
                requiredKey = 'AA';
                label = 'AA';
                break;
            case 17:
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
            case 4:
                requiredKey = 'PREMIUM';
                label = 'PREMIUM';
                break;
            case 3:
                requiredKey = 'AA';
                label = 'AA';
                break;
            case 2:
                requiredKey = 'A';
                label = 'A';
                break;
            default:
                requiredKey = 'A';
                label = 'A';
                break;
        }
        const mult = readMultiplierOrError(requiredKey, label);
        if (mult === null) {
            return NextResponse.json(
                { error: `Configuration value missing or invalid for client type '${requiredKey}'` },
                { status: 500 }
            );
        }
        return { profitPercentage: mult, clientTypeName };
    }

    const mult = readMultiplierOrError('A', 'A');
    if (mult === null) {
        return NextResponse.json(
            { error: "Configuration value missing or invalid for client type 'A'" },
            { status: 500 }
        );
    }
    return { profitPercentage: mult, clientTypeName };
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        let { partNumber: rawPartNumber, clientType } = await request.json();
        
        if (rawPartNumber) {
            rawPartNumber = String(rawPartNumber).toUpperCase().trim();
        }

        if (!rawPartNumber) {
            return NextResponse.json(
                { error: 'Part number is required' },
                { status: 400 }
            );
        }

        const partNumber = normalizeReference(String(rawPartNumber));

        const costexApiUrl = process.env.COSTEX_API_URL;
        const accessKey = process.env.COSTEX_ACCESS_KEY;
        const userId = process.env.COSTEX_USER_ID;
        const password = process.env.COSTEX_PASSWORD;
        const customer = process.env.COSTEX_CUSTOMER;

        if (!costexApiUrl || !accessKey || !userId || !password || !customer) {
            console.error('Missing Costex API configuration');
            return NextResponse.json(
                { error: 'External API configuration missing' },
                { status: 500 }
            );
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
            return NextResponse.json(
                { error: 'External API request failed' },
                { status: response.status }
            );
        }

        const data = await response.json();
        const allLocations = data.Locations || {};

        console.log(`[COSTEX-API] Received data for part "${partNumber}":`, {
            found: !!data.strPartNumber,
            locationsCount: Object.keys(allLocations).length,
            locations: Object.keys(allLocations)
        });

        const resolved: Array<{ locationKey: string; locCode: string; row: any }> = [];
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
            return NextResponse.json(
                {
                    success: false,
                    error: 'Part not available at Location01 or Location05',
                    found: false,
                },
                { status: 404 }
            );
        }

        const configResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/config`, {
            headers: {
                Cookie: request.headers.get('cookie') || '',
            },
        });
        const configData = await configResponse.json();
        const configs = configData.data || {};

        const profitResult = resolveProfitMultiplier(configs, clientType);
        if (profitResult instanceof NextResponse) {
            return profitResult;
        }
        const { profitPercentage, clientTypeName } = profitResult;

        const profitFraction = profitPercentage <= 1 ? profitPercentage : profitPercentage / 100;
        const safeProfitFraction = profitFraction > 0 ? profitFraction : 0.75;

        console.log(
            `💰 [COSTEX] clientType=${clientType ?? 'none (default A)'}, clientTypeName=${clientTypeName}, profitFraction=${safeProfitFraction.toFixed(4)}`
        );

        const rows: any[] = [];

        for (const { locationKey, locCode, row } of resolved) {
            const rawCustPrice = row.CustPrice ?? '';
            const basePriceUSD = parseFloat((rawCustPrice || '0').replace(/,/g, ''));
            const totalStock = parseInt(String(row.NetQtyStock ?? '0'), 10) || 0;
            const locationsScoped = { [locationKey]: row };
            const branchName = typeof row.BranchName === 'string' ? row.BranchName.trim() : '';

            const precioVentaUSD = basePriceUSD / safeProfitFraction;

            console.log(
                `✅ [COSTEX-LOC${locCode}] CustPrice="${rawCustPrice}" → basePriceUSD=$${basePriceUSD.toFixed(2)}, stock=${totalStock}, sellPriceUSD=$${precioVentaUSD.toFixed(2)}, ${branchName || locationKey}`
            );

            const structuredData: any = {
                partNumber: data.strPartNumber || partNumber,
                description: data.strDescrip1 || '',
                listPriceUSD: parseFloat((data.dblListPrice || '0').replace(/,/g, '')),
                listPriceCOP: 0,
                weight: {
                    pounds: parseFloat(data.intWeigthPnd || '0'),
                    kilograms: parseFloat(data.dblWeigthKgs || '0'),
                },
                dimensions: {
                    length: parseFloat(data.dblLengthIn || '0'),
                    width: parseFloat(data.dblWidthIn || '0'),
                    height: parseFloat(data.dblHeightIn || '0'),
                    volume: parseFloat(data.dblVolumeIn3 || '0'),
                },
                category: {
                    major: data.strMajorDsc || '',
                    category: data.strCategoryDs || '',
                    subCategory: data.strSbCatDsc || '',
                    minor: data.strMinorDsc || '',
                },
                imageUrl: data.strFlgCtpPho || '',
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
            };

            structuredData.calculation = {
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
            };

            rows.push(structuredData);
        }

        console.log(`Costex search performed for part: ${partNumber} by user: ${session.user.id} (${rows.length} location row(s))`);

        return NextResponse.json({
            success: true,
            data: rows,
            source: 'costex',
        });
    } catch (error: any) {
        console.error(`[COSTEX-API] Search error:`, {
            error: error.message || error,
            stack: error.stack?.substring(0, 500),
        });
        return NextResponse.json(
            { error: 'External search failed' },
            { status: 500 }
        );
    }
}
