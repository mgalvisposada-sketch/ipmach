/**
 * Extracts text from the product catalog PDF and parses it for part numbers,
 * descriptions, and uses. Filters out irrelevant sections (history, founders, etc.).
 *
 * Run: npm run catalog:extract
 * Output: mi-catalogo/extracted-raw.txt, mi-catalogo/catalog-data.json
 */

import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

const CATALOG_DIR = path.join(process.cwd(), 'mi-catalogo');
const PDF_PATH = path.join(CATALOG_DIR, 'product-overview-2025.pdf');
const RAW_OUTPUT = path.join(CATALOG_DIR, 'extracted-raw.txt');
const JSON_OUTPUT = path.join(CATALOG_DIR, 'catalog-data.json');

const IRRELEVANT_KEYWORDS = [
  'history',
  'historia',
  'founder',
  'fundador',
  'about us',
  'quienes somos',
  'our story',
  'nuestra historia',
  'mission',
  'misión',
  'vision',
  'visión',
  'team',
  'equipo',
  'company overview',
  'introduction',
  'introducción',
  'welcome',
  'bienvenid',
  'certifications',
  'certificaciones',
  'contact us',
  'contáctenos',
  'careers',
  'trabajo',
  'sustainability',
  'sostenibilidad',
];

const PART_NUMBER_PATTERNS = [
  /\b[A-Z0-9]{2,5}-[A-Z0-9-]+\b/i,
  /\b[A-Z]{2,4}\d{4,8}\b/,
  /\b\d{3}-\d{2}-\d{5}\b/,
  /\b[A-Z0-9]{4,12}\b/g,
];

interface CatalogItem {
  partNumber: string;
  description: string;
  use?: string;
  category?: string;
  rawLine?: string;
}

function isLikelyIrrelevantSection(sectionText: string): boolean {
  const lower = sectionText.toLowerCase().slice(0, 500);
  return IRRELEVANT_KEYWORDS.some((kw) => lower.includes(kw));
}

function looksLikePartNumber(token: string): boolean {
  if (token.length < 3 || token.length > 25) return false;
  const hasDigit = /\d/.test(token);
  const hasLetter = /[A-Za-z]/.test(token);
  if (!hasDigit || !hasLetter) return false;
  if (/^[\d\s\-\.]+$/.test(token)) return false;
  return PART_NUMBER_PATTERNS.some((re) => {
    const m = token.match(re);
    return m && m[0].length >= 4;
  });
}

function extractItemsFromText(fullText: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const looksLikeHeader = line.length < 80 && (line === line.toUpperCase() || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(line));
    if (looksLikeHeader && current.length > 5) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length) sections.push(current.join('\n'));

  const relevantSections = sections.filter((s) => !isLikelyIrrelevantSection(s));

  for (const section of relevantSections) {
    const sectionLines = section.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < sectionLines.length; i++) {
      const line = sectionLines[i];
      const tokens = line.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        const cleaned = token.replace(/[,\.;:]$/, '');
        if (looksLikePartNumber(cleaned)) {
          const description = sectionLines[i + 1] || line.slice(line.indexOf(cleaned) + cleaned.length).trim() || line;
          const existing = items.find((it) => it.partNumber === cleaned);
          if (!existing && description.length > 3) {
            items.push({
              partNumber: cleaned,
              description: description.length > 200 ? description.slice(0, 200) + '...' : description,
              rawLine: line,
            });
          }
          break;
        }
      }
    }
  }

  const byTableLines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < byTableLines.length; i++) {
    const line = byTableLines[i];
    const match = line.match(/\b([A-Z0-9]{4,}[-]?[A-Z0-9-]*)\s+(.+)/i);
    if (match) {
      const [, part, desc] = match;
      if (looksLikePartNumber(part) && desc.length > 5 && desc.length < 400) {
        const existing = items.find((it) => it.partNumber === part);
        if (!existing) {
          items.push({
            partNumber: part,
            description: desc.slice(0, 300),
            rawLine: line,
          });
        }
      }
    }
  }

  return items;
}

async function main() {
  if (!fs.existsSync(PDF_PATH)) {
    console.error('PDF not found at:', PDF_PATH);
    process.exit(1);
  }

  console.log('Reading PDF:', PDF_PATH);
  const dataBuffer = fs.readFileSync(PDF_PATH);

  const data = await pdfParse(dataBuffer);
  const text = data.text as string;
  const numPages = data.numpages as number;

  console.log('Pages:', numPages);
  console.log('Total characters:', text.length);

  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });

  fs.writeFileSync(RAW_OUTPUT, text, 'utf8');
  console.log('Raw text saved to:', RAW_OUTPUT);

  const items = extractItemsFromText(text);
  console.log('Extracted items (heuristic):', items.length);

  const catalog = {
    source: 'product-overview-2025.pdf',
    extractedAt: new Date().toISOString(),
    totalPages: numPages,
    items: items.slice(0, 2000),
    totalExtracted: items.length,
  };

  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('Catalog JSON saved to:', JSON_OUTPUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
