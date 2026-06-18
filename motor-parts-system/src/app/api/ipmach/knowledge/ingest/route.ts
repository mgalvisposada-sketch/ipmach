import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runIngest } from '@/lib/ipmach-ingest';

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const mod = await import('pdf-parse') as unknown as { default?: (buf: Buffer) => Promise<{ text?: string }> } | ((buf: Buffer) => Promise<{ text?: string }>);
  const fn = typeof (mod as { default?: (buf: Buffer) => Promise<{ text?: string }> }).default === 'function'
    ? (mod as { default: (buf: Buffer) => Promise<{ text?: string }> }).default
    : (mod as (buf: Buffer) => Promise<{ text?: string }>);
  const data = await fn(buffer);
  return data.text ?? '';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawTextParam = formData.get('text') as string | null;
    const source = (formData.get('source') as string)?.trim() || 'manual';
    const type = (formData.get('type') as string)?.trim() || 'catalog';

    let text = '';

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const name = (file.name || '').toLowerCase();
      if (name.endsWith('.pdf')) {
        text = await extractTextFromPdf(buffer);
      } else if (name.endsWith('.txt') || file.type === 'text/plain') {
        text = buffer.toString('utf8');
      } else {
        return NextResponse.json(
          { error: 'Unsupported file type. Use PDF or TXT.' },
          { status: 400 }
        );
      }
    }

    if (rawTextParam && rawTextParam.trim()) {
      text = text ? text + '\n\n' + rawTextParam.trim() : rawTextParam.trim();
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: 'Provide a file (PDF/TXT) or paste text to index.' },
        { status: 400 }
      );
    }

    const result = await runIngest(text.trim(), source, type);
    return NextResponse.json({
      inserted: result.inserted,
      chunks: result.chunks,
      message: `Indexed ${result.inserted} fragments from ${result.chunks} chunks.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingest failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
