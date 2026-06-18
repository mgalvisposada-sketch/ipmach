import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getSimilarChunks, hasVectorConfig, getKeywordChunks } from '@/lib/ipmach-vector';
import { classifyUserIntent, type UserIntent } from '@/lib/ipmach-intent-classifier';
import { getSystemPrompt, getModelConfig } from '@/lib/ipmach-prompts';

const CATALOG_RAW = path.join(process.cwd(), 'mi-catalogo', 'extracted-raw.txt');
const CATALOG_JSON = path.join(process.cwd(), 'mi-catalogo', 'catalog-data.json');
const MAX_CONTEXT_CHARS = 32000;
const MAX_HISTORY_MESSAGES = 10;
const MAX_CLARIFYING_QUESTIONS = 5;

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Try to parse LLM response as JSON with clarifyingQuestions. Returns null if not valid.
 * Tolerates JSON wrapped in markdown code blocks (e.g. ```json ... ```).
 */
function parseClarifyingResponse(raw: string): string[] | null {
  let trimmed = raw.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    trimmed = codeBlockMatch[1].trim();
  }
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as { clarifyingQuestions?: unknown };
    const q = parsed.clarifyingQuestions;
    if (!Array.isArray(q) || q.length === 0) return null;
    const questions = q
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, MAX_CLARIFYING_QUESTIONS);
    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

/**
 * Estimate cost of OpenAI API call based on tokens and model
 */
function estimateCost(tokens: number, model: string): string {
  // Precios aproximados por 1M tokens (2024)
  const prices: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
  };
  
  const price = prices[model] || prices['gpt-4o-mini'];
  // Asumimos 50/50 input/output para simplificar
  const costPer1M = (price.input + price.output) / 2;
  const cost = (tokens / 1_000_000) * costPer1M;
  
  return `$${cost.toFixed(4)}`;
}

/** Spanish -> English (and common terms) so we match catalog in English when user asks in Spanish */
const QUERY_EXPAND_ES_EN: Record<string, string[]> = {
  bomba: ['pump', 'pumps', 'bomba'],
  hidraulica: ['hydraulic', 'hydraulics', 'hidraulica'],
  hidráulica: ['hydraulic', 'hydraulics', 'hidraulica'],
  motor: ['engine', 'engines', 'motor'],
  filtro: ['filter', 'filters', 'filtro'],
  aceite: ['oil', 'oils', 'aceite'],
  transmision: ['transmission', 'transmissions', 'transmision'],
  transmisión: ['transmission', 'transmissions', 'transmision'],
  rodaje: ['undercarriage', 'track', 'tracks', 'rodaje'],
  oruga: ['track', 'tracks', 'undercarriage', 'oruga'],
  cabina: ['cab', 'cabinet', 'cabina'],
  excavadora: ['excavator', 'excavators', 'excavadora'],
  excavador: ['excavator', 'excavators', 'excavador'],
  bulldozer: ['dozer', 'dozers', 'bulldozer'],
  carga: ['loader', 'loaders', 'load', 'carga'],
  cilindro: ['cylinder', 'cylinders', 'cilindro'],
  correa: ['belt', 'belts', 'correa'],
  engranaje: ['gear', 'gears', 'engranaje'],
  freno: ['brake', 'brakes', 'freno'],
  manguera: ['hose', 'hoses', 'manguera'],
  sellos: ['seals', 'seal', 'sellos'],
  repuesto: ['part', 'parts', 'replacement', 'spare', 'repuesto'],
  pieza: ['part', 'parts', 'component', 'pieza'],
  kit: ['kit', 'kits', 'kit'],
};

function getCatalogText(): string {
  if (fs.existsSync(CATALOG_RAW)) {
    return fs.readFileSync(CATALOG_RAW, 'utf8');
  }
  if (fs.existsSync(CATALOG_JSON)) {
    const data = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
    const items = data.items || [];
    return items
      .map(
        (i: { partNumber?: string; description?: string }) =>
          `${i.partNumber || ''} ${i.description || ''}`.trim()
      )
      .filter(Boolean)
      .join('\n\n');
  }
  return '';
}

function chunkText(text: string, chunkSize = 1200): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let current = '';
  for (const p of paragraphs) {
    if (current.length + p.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += (current ? '\n\n' : '') + p.trim();
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Normalize part number for matching: lowercase, remove spaces/dashes (e.g. "9X-1439" -> "9x1439"). */
function normalizePartNumber(raw: string): string {
  return raw.replace(/[\s\-_]+/g, '').toLowerCase();
}

function getSearchTerms(query: string): { terms: string[]; numbers: string[]; partNumbers: string[] } {
  const q = query.toLowerCase().replace(/\s+/g, ' ').trim();
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const numbers = query.match(/\b\d{2,5}\b/g) || [];
  const partNumbersRaw = query.match(/\b[A-Za-z0-9]*\d+[A-Za-z0-9\-]*\b/g) || [];
  const partNumbers = Array.from(new Set(partNumbersRaw.map(normalizePartNumber).filter((s) => s.length >= 2)));
  const expanded = new Set<string>(terms);
  for (const t of terms) {
    const key = t.replace(/[áéíóúü]/g, (c) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' }[c] || c));
    if (QUERY_EXPAND_ES_EN[key]) {
      QUERY_EXPAND_ES_EN[key].forEach((w) => expanded.add(w.toLowerCase()));
    }
  }
  return { terms: Array.from(expanded), numbers, partNumbers };
}

function scoreChunk(chunk: string, query: string): number {
  const { terms, numbers, partNumbers } = getSearchTerms(query);
  const lower = chunk.toLowerCase();
  const chunkNormalized = normalizePartNumber(chunk);
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
    if (term.length > 3 && lower.includes(term)) score += 2;
  }
  for (const num of numbers) {
    if (lower.includes(num)) score += 3;
  }
  for (const pn of partNumbers) {
    if (chunkNormalized.includes(pn) || lower.includes(pn)) score += 5;
  }
  return score;
}

function selectRelevantChunks(fullText: string, query: string, maxChars: number): string {
  const chunks = chunkText(fullText);
  const scored = chunks.map((c) => ({ chunk: c, score: scoreChunk(c, query) }));
  scored.sort((a, b) => b.score - a.score);
  let total = 0;
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const { chunk } of scored) {
    if (seen.has(chunk)) continue;
    if (total + chunk.length > maxChars) continue;
    selected.push(chunk);
    seen.add(chunk);
    total += chunk.length;
  }
  if (selected.length === 0 && fullText.length > 0) {
    return fullText.slice(0, maxChars);
  }
  const topScore = scored[0]?.score ?? 0;
  const { partNumbers } = getSearchTerms(query);
  if (topScore === 0 && chunks.length > 0) {
    const numbers = query.match(/\b\d{2,5}\b/g) || [];
    const matchPartOrNumber = (chunk: string) => {
      const cNorm = normalizePartNumber(chunk);
      const cLower = chunk.toLowerCase();
      if (numbers.some((n) => cLower.includes(n))) return true;
      return partNumbers.some((pn) => cNorm.includes(pn) || cLower.includes(pn));
    };
    for (const { chunk } of scored) {
      if (seen.has(chunk)) continue;
      if (matchPartOrNumber(chunk) && total + chunk.length <= maxChars) {
        selected.push(chunk);
        seen.add(chunk);
        total += chunk.length;
      }
    }
    if (selected.length === 0) {
      selected.push(...scored.slice(0, 30).map((s) => s.chunk));
      total = selected.reduce((acc, c) => acc + c.length, 0);
      if (total > maxChars) {
        let trim = 0;
        while (selected.length && trim + selected.reduce((a, c) => a + c.length, 0) > maxChars) {
          trim += selected.pop()!.length;
        }
      }
    }
  }
  return selected.join('\n\n---\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = typeof body.message === 'string' ? body.message.trim() : '';
    const sourceFilter = typeof body.sourceFilter === 'string' && body.sourceFilter.trim()
      ? body.sourceFilter.trim()
      : undefined;
    const rawHistory = body.conversationHistory;
    const conversationHistory: ConversationTurn[] = Array.isArray(rawHistory)
      ? rawHistory
          .filter((t: unknown) => t && typeof t === 'object' && 'role' in t && 'content' in t)
          .map((t: { role: string; content: string }) => ({
            role: t.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: String(t.content ?? '').trim(),
          }))
          .filter((t) => t.content.length > 0)
          .slice(-MAX_HISTORY_MESSAGES)
      : [];
    if (!question) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const catalogText = getCatalogText();
      const context = catalogText ? selectRelevantChunks(catalogText, question, MAX_CONTEXT_CHARS) : '';
      return NextResponse.json({
        answer:
          'Respuestas con IA no están configuradas (OPENAI_API_KEY).' +
          (context ? ' Fragmentos del catálogo:\n\n' + context.slice(0, 2000) + (context.length > 2000 ? '...' : '') : ''),
      });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

    // PASO 1: Clasificar intención (REFERENCE_LOOKUP | ADMIN | REDIRECT_MACHINE_REF)
    let userIntent: UserIntent;
    try {
      userIntent = await classifyUserIntent(question, openai);
      console.log('[ipmach/ask] Intent classified as:', userIntent);
    } catch (e) {
      console.warn('[ipmach/ask] Classification failed, defaulting to REFERENCE_LOOKUP', e);
      userIntent = 'REFERENCE_LOOKUP';
    }

    // REDIRECT: user asked "which reference for this machine?" — do not answer with a part number; guide to search/supplier
    const REDIRECT_MACHINE_REF_MESSAGE =
      'Para saber qué referencia o part number usa una máquina específica necesitas el número de parte. ' +
      'Si ya lo tienes, búscalo en la barra de búsqueda de la página para ver disponibilidad y precio. ' +
      'Si no lo tienes, consulta con tu proveedor o con el manual de la máquina. ' +
      'Aquí puedo ayudarte cuando tengas una referencia concreta: por ejemplo "¿para qué máquinas sirve 5S6684?" o "¿qué es la referencia 9X1439?".';
    if (userIntent === 'REDIRECT_MACHINE_REF') {
      return NextResponse.json({ answer: REDIRECT_MACHINE_REF_MESSAGE });
    }

    // PASO 2: Obtener configuración según intención
    const { model, maxTokens, temperature } = getModelConfig(userIntent);
    const systemPrompt = getSystemPrompt(userIntent);

    console.log('[ipmach/ask] Using model:', model, 'for intent:', userIntent);

    // PASO 3: Búsqueda de contexto
    let context = '';
    if (hasVectorConfig()) {
      try {
        console.log('[ipmach/ask] Query:', question);
        if (sourceFilter) {
          console.log('[ipmach/ask] Source filter:', sourceFilter);
        }
        
        // Vector search (semantic similarity)
        const embedRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: [question],
        });
        const embedding = embedRes.data[0]?.embedding;
        let vectorChunks: { content: string; source: string; type: string }[] = [];
        if (embedding?.length === 1536) {
          vectorChunks = await getSimilarChunks(embedding, sourceFilter);
          console.log('[ipmach/ask] Vector chunks found:', vectorChunks.length);
        }

        // Keyword search (exact matching for part numbers and important terms)
        const { partNumbers } = getSearchTerms(question);
        const searchTerms = question
          .toLowerCase()
          .split(/\s+/)
          .filter((t: string) => t.length > 3 && !['para', 'sobre', 'tengo', 'tiene', 'cual', 'cuales', 'donde', 'cuando'].includes(t));
        const keywords = [...partNumbers, ...searchTerms].slice(0, 10); // Limit to 10 keywords
        
        let keywordChunks: { content: string; source: string; type: string }[] = [];
        if (keywords.length > 0) {
          keywordChunks = await getKeywordChunks(keywords, 15);
          console.log('[ipmach/ask] Keyword chunks found:', keywordChunks.length);
        }

        // Combine and deduplicate chunks
        const allChunks = [...vectorChunks, ...keywordChunks];
        const uniqueContent = new Map<string, { content: string; source: string; type: string }>();
        allChunks.forEach(c => {
          if (!uniqueContent.has(c.content)) {
            uniqueContent.set(c.content, c);
          }
        });

        const combinedChunks = Array.from(uniqueContent.values());
        console.log('[ipmach/ask] Total unique chunks:', combinedChunks.length);
        console.log('[ipmach/ask] Sample sources:', 
          combinedChunks.slice(0, 5).map(c => `${c.source}/${c.type}`));

        if (combinedChunks.length > 0) {
          // Respect MAX_CONTEXT_CHARS limit
          let total = 0;
          const limitedChunks: { content: string; source: string; type: string }[] = [];
          for (const chunk of combinedChunks) {
            if (total + chunk.content.length > MAX_CONTEXT_CHARS) break;
            limitedChunks.push(chunk);
            total += chunk.content.length;
          }
          context = limitedChunks.map(c => c.content).join('\n\n---\n\n');
          console.log('[ipmach/ask] Final context length:', context.length);
        }
      } catch (e) {
        console.warn('[ipmach/ask] vector/keyword search failed', e);
      }
    }
    const catalogText = getCatalogText();
    const { partNumbers } = getSearchTerms(question);
    if (partNumbers.length > 0 && catalogText) {
      const chunksWithPart = chunkText(catalogText).filter((c) => {
        const cNorm = normalizePartNumber(c);
        const cLower = c.toLowerCase();
        return partNumbers.some((pn) => cNorm.includes(pn) || cLower.includes(pn));
      });
      if (chunksWithPart.length > 0) {
        let len = 0;
        const limited = chunksWithPart.filter((c) => {
          if (len + c.length > MAX_CONTEXT_CHARS) return false;
          len += c.length;
          return true;
        });
        const partContext = limited.join('\n\n---\n\n');
        context = context ? `${partContext}\n\n---\n\n${context}` : partContext;
      }
    }
    if (!context) {
      if (!catalogText) {
        return NextResponse.json({
          answer:
            'El catálogo no está cargado. Ejecuta "npm run catalog:extract" y luego "npm run catalog:ingest" (o solo ingest si ya tienes la base vectorial en Supabase).',
        });
      }
      context = selectRelevantChunks(catalogText, question, MAX_CONTEXT_CHARS);
    }

    // PASO 4: Build messages with optional conversation history + current question with catalog context
    const historyMessages: { role: 'user' | 'assistant'; content: string }[] = conversationHistory.map(
      (t) => ({ role: t.role, content: t.content })
    );
    const userMessageWithContext = `Contenido del catálogo:\n\n${context}\n\n---\n\nPregunta del cliente: ${question}`;
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessageWithContext },
    ];

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const rawContent =
      response.choices?.[0]?.message?.content?.trim() ||
      'No pude generar una respuesta. Prueba reformulando la pregunta.';

    const clarifyingQuestions = parseClarifyingResponse(rawContent);
    if (clarifyingQuestions !== null) {
      console.log('[ipmach/ask] Response type: clarifyingQuestions', clarifyingQuestions.length);
      return NextResponse.json({ clarifyingQuestions });
    }

    const answer = rawContent;

    // PASO 5: Log de métricas para análisis de uso y costos
    const tokensUsed = response.usage?.total_tokens || 0;
    const estimatedCost = estimateCost(tokensUsed, model);

    console.log('[ipmach/ask/metrics]', {
      timestamp: new Date().toISOString(),
      intent: userIntent,
      model,
      question: question.slice(0, 50) + (question.length > 50 ? '...' : ''),
      tokensUsed,
      estimatedCost,
      sourceFilter: sourceFilter || 'none',
      contextLength: context.length,
      historyTurns: conversationHistory.length,
    });

    return NextResponse.json({ answer });
  } catch (e) {
    console.error('[ipmach/ask]', e);
    const message = e instanceof Error ? e.message : String(e);
    const sanitized = message.includes('sk-') ? 'Revisa tu OPENAI_API_KEY en .env' : message;
    return NextResponse.json(
      {
        answer:
          'Hubo un error al consultar la base de conocimiento. ' +
          (sanitized ? `Detalle: ${sanitized}` : 'Revisa la consola del servidor (terminal) para más información.'),
      },
      { status: 500 }
    );
  }
}
