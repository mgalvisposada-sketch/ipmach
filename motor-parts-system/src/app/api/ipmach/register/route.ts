/**
 * IPMach registration: notification only (no order created).
 * POST body: reference, name, email, message (optional).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendIPMachRegistrationNotification } from '@/lib/email';

export const dynamic = 'force-dynamic';

const MAX_REFERENCE = 50;
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_MESSAGE = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitize(str: string, maxLen: number): string {
  return str.trim().slice(0, maxLen);
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Body must be an object' },
        { status: 400 }
      );
    }

    const raw = body as Record<string, unknown>;
    const reference = sanitize(String(raw.reference ?? ''), MAX_REFERENCE);
    const name = sanitize(String(raw.name ?? ''), MAX_NAME);
    const email = sanitize(String(raw.email ?? ''), MAX_EMAIL);
    const message = raw.message != null ? sanitize(String(raw.message), MAX_MESSAGE) : '';

    if (!reference) {
      return NextResponse.json(
        { success: false, error: 'reference is required' },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name is required' },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400 }
      );
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const result = await sendIPMachRegistrationNotification({
      to: email,
      reference,
      name,
      email,
      message: message || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('IPMach register API error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    );
  }
}
