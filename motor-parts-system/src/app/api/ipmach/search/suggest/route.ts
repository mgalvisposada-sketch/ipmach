/**
 * Public suggestions for IPMach search bar. No auth required.
 * Stock service was removed; returns empty suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({ suggestions: [] });
    }
    return NextResponse.json({ suggestions: [] });
  } catch (error) {
    console.error('IPMach suggest error:', error);
    return NextResponse.json({ suggestions: [] }, { status: 200 });
  }
}
