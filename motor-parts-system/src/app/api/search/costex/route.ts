import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { partNumber: rawPartNumber, clientType } = await request.json();

        if (!rawPartNumber) {
            return NextResponse.json(
                { error: 'Part number is required' },
                { status: 400 }
            );
        }

        // Normalize part number for Costex: "1P 8116", "1P-8116" and "1P8116" are the same
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
                'Cookie': 'PHPSESSID=uaodj7qancba110487omvsrppc4or48p'
            },
            body: formData.toString(),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[COSTEX-API] Request failed for part "${partNumber}":`, {
                status: response.status,
                statusText: response.statusText,
                errorBody: errorBody.substring(0, 500) // First 500 chars
            });
            return NextResponse.json(
                { error: 'External API request failed' },
                { status: response.status }
            );
        }

        const data = await response.json();
        const allLocations = data.Locations || {};

        // Only Location01 counts: use key "Location01" or LocCode "01"
        const location01Data = allLocations.Location01 ?? Object.values(allLocations).find((loc: any) => (loc?.LocCode?.trim() ?? '') === '01');

        if (!location01Data) {
            const availableLocations = Object.keys(allLocations);
            console.warn(`⚠️ [COSTEX-LOC01] Location01 not found for part "${partNumber}".`);
            console.warn(`[COSTEX-LOC01] Available locations:`, availableLocations.length > 0 ? availableLocations : 'None');
            if (availableLocations.length > 0) {
                console.log('[COSTEX-LOC01] First location sample:', JSON.stringify(allLocations[availableLocations[0]], null, 2).substring(0, 500));
            } else {
                console.log('[COSTEX-LOC01] Full Costex response:', JSON.stringify(data, null, 2).substring(0, 1000));
            }
            return NextResponse.json(
                { success: false, error: 'Part not available at Location01', found: false },
                { status: 404 }
            );
        }

        const rawCustPrice = location01Data.CustPrice ?? '';
        const basePriceUSD = parseFloat((rawCustPrice || '0').replace(/,/g, ''));
        const totalStock = parseInt(location01Data.NetQtyStock) ?? 0;
        const locationsOnly01 = { Location01: location01Data };

        console.log(`✅ [COSTEX-LOC01] Original price from external endpoint (CustPrice): "${rawCustPrice}" → parsed basePriceUSD: $${basePriceUSD}, Stock: ${totalStock}, Location: ${location01Data.BranchName?.trim() || 'Location01'}`);

        // Get client type multiplier from config
        const configResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/api/config`, {
            headers: {
                'Cookie': request.headers.get('cookie') || '',
            },
        });
        const configData = await configResponse.json();
        const configs = configData.data || {};

        let profitPercentage: number;
        let clientTypeName = 'A';

        const readMultiplierOrError = (key: string, label: string): number | null => {
            const val = configs[key]?.value;
            if (typeof val !== 'number' || !(val > 0)) {
                return null;
            }
            clientTypeName = label;
            return val;
        };

        if (clientType) {
            let requiredKey = '';
            let label = '';
            switch (clientType) {
                // Nueva convención (14-17) según configuración
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
                // Convención antigua (2-6)
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
            profitPercentage = mult;
        } else {
            const mult = readMultiplierOrError('A', 'A');
            if (mult === null) {
                return NextResponse.json(
                    { error: "Configuration value missing or invalid for client type 'A'" },
                    { status: 500 }
                );
            }
            profitPercentage = mult;
        }

        const profitFraction = profitPercentage <= 1 ? profitPercentage : (profitPercentage / 100);
        const safeProfitFraction = profitFraction > 0 ? profitFraction : 0.75;
        const precioVentaUSD = basePriceUSD / safeProfitFraction;

        console.log(`💰 [COSTEX] clientType=${clientType ?? 'none (default A)'}, clientTypeName=${clientTypeName}, profitPercentage=${profitPercentage}, profitFraction=${safeProfitFraction.toFixed(4)}, basePriceUSD=$${basePriceUSD.toFixed(2)}, sellPriceUSD=$${precioVentaUSD.toFixed(2)}`);

        const structuredData: any = {
            partNumber: data.strPartNumber || partNumber,
            description: data.strDescrip1 || '',
            listPriceUSD: parseFloat((data.dblListPrice || '0').replace(/,/g, '')),
            listPriceCOP: 0,
            weight: {
                pounds: parseFloat(data.intWeigthPnd || '0'),
                kilograms: parseFloat(data.dblWeigthKgs || '0')
            },
            dimensions: {
                length: parseFloat(data.dblLengthIn || '0'),
                width: parseFloat(data.dblWidthIn || '0'),
                height: parseFloat(data.dblHeightIn || '0'),
                volume: parseFloat(data.dblVolumeIn3 || '0')
            },
            category: {
                major: data.strMajorDsc || '',
                category: data.strCategoryDs || '',
                subCategory: data.strSbCatDsc || '',
                minor: data.strMinorDsc || ''
            },
            imageUrl: data.strFlgCtpPho || '',
            locations: locationsOnly01,
            totalStock,
            baseCostUSD: basePriceUSD,
            minPriceUSD: precioVentaUSD,
            maxPriceUSD: precioVentaUSD,
            minPriceCOP: 0,
            maxPriceCOP: 0,
            rawData: data
        };

        structuredData.calculation = {
            rules: {
                clientType: clientTypeName,
                profitPercentage,
                formula: 'precioVentaUSD = Location01.CustPrice / profitFraction'
            },
            inputs: {
                baseCostUSD: basePriceUSD,
                profitPercentage
            },
            intermediate: {
                profitFraction: Number(safeProfitFraction.toFixed(4))
            },
            outputs: {
                sellPriceUSD: Number(precioVentaUSD.toFixed(2))
            }
        };

        console.log(`Costex search performed for part: ${partNumber} by user: ${session.user.id}`);
        console.log(`📦 [COSTEX RESULT] partNumber=${structuredData.partNumber}, description=${structuredData.description || '(none)'}, totalStock=${structuredData.totalStock}, sellPriceUSD=$${precioVentaUSD.toFixed(2)}, location=${location01Data.BranchName?.trim() || 'Location01'}`);

        return NextResponse.json({
            success: true,
            data: structuredData,
            source: 'costex'
        });

    } catch (error: any) {
        console.error(`[COSTEX-API] Search error for part "${request.headers.get('x-part-number') || 'unknown'}":`, {
            error: error.message || error,
            stack: error.stack?.substring(0, 500)
        });
        return NextResponse.json(
            { error: 'External search failed' },
            { status: 500 }
        );
    }
}
