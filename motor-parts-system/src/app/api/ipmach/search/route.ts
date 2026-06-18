/**
 * Public search API for IPMach landing.
 * Same data source as quote search (Costex). Single reference only; no batch.
 * Returns reference, description, quantity, image for display and "Registrar" flow.
 * Price and location are not sent to the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeReference } from '@/lib/analytics/conversion-calculator';

export const dynamic = 'force-dynamic';

const MAX_REFERENCE_LENGTH = 50;

function isValidSingleReference(q: string): boolean {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length > MAX_REFERENCE_LENGTH) return false;
  if (/\n|\r|,|;/.test(trimmed)) return false;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || searchParams.get('reference') || '').trim();
    if (!q) {
      return NextResponse.json({ success: true, data: [], message: 'Se requiere el parámetro de búsqueda' });
    }
    if (!isValidSingleReference(q)) {
      return NextResponse.json(
        { success: false, error: 'Solo un número de parte; sin búsqueda masiva ni caracteres especiales', data: [] },
        { status: 400 }
      );
    }

    const partNumber = normalizeReference(q);
    const costexApiUrl = process.env.COSTEX_API_URL;
    const accessKey = process.env.COSTEX_ACCESS_KEY;
    const userId = process.env.COSTEX_USER_ID;
    const password = process.env.COSTEX_PASSWORD;
    const customer = process.env.COSTEX_CUSTOMER;

    if (!costexApiUrl || !accessKey || !userId || !password || !customer) {
      console.warn('[IPMach search] Missing Costex API configuration');
      return NextResponse.json({ success: true, data: [], message: 'Búsqueda temporalmente no disponible' });
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
      return NextResponse.json({ success: true, data: [] });
    }

    const data = await response.json();
    const allLocations = data.Locations || {};
    const location01Data =
      allLocations.Location01 ??
      Object.values(allLocations).find((loc: unknown) => (loc as { LocCode?: string })?.LocCode?.trim() === '01');

    if (!location01Data) {
      return NextResponse.json({ success: true, data: [] });
    }

    const quantity = parseInt(location01Data.NetQtyStock, 10) || 0;

    const result = {
      reference: data.strPartNumber || partNumber,
      description: (data.strDescrip1 || '').trim() || undefined,
      quantity,
      imageUrl: (data.strFlgCtpPho || '').trim() || undefined,
      hasStock: quantity > 0,
    };

    return NextResponse.json({ success: true, data: [result] });
  } catch (error) {
    console.error('IPMach search error:', error);
    return NextResponse.json({ success: false, error: 'Error en la búsqueda', data: [] }, { status: 500 });
  }
}
