import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';

/**
 * Parser for AgroCosta (agro-costa.com)
 * Handles HTML responses from their inventory search system
 */
export class AgroCostaParser extends BaseParser {
    readonly originCode = 'AGROCOSTA';
    readonly originName = 'AgroCosta';

    canParse(content: string | object): boolean {
        if (typeof content !== 'string') return false;

        // Check for AgroCosta-specific markers
        return (
            content.includes('agro-costa.com') ||
            content.includes('consulta_inventario') ||
            content.includes('inventario') ||
            content.includes('disponibilidad')
        );
    }

    async parse(html: string, searchTerm: string): Promise<ParseResult> {
        const $ = this.loadCheerio(html);
        const products: Product[] = [];

        console.log(`🔍 [AGROCOSTA] Parsing HTML for search term: "${searchTerm}"`);
        console.log(`🔍 [AGROCOSTA] HTML length: ${html.length} characters`);

        // Check if we got a login page (session expired)
        if (html.includes('Iniciar sesión') || html.includes('La sesión ha caducado') || html.includes('login') || html.includes('Iniciar')) {
            console.warn('⚠️ [AGROCOSTA] Login page detected - session may have expired');
            // Return empty result with metadata indicating login needed
            return {
                originCode: this.originCode,
                originName: this.originName,
                searchTerm,
                products: [],
                metadata: {
                    totalFound: 0,
                    error: 'Session expired - login required',
                },
            };
        }

        // Check for "no results" messages
        const pageText = $.text().toLowerCase();
        const noResultsIndicators = [
            'no se encontraron resultados',
            'no se encontraron productos',
            'sin resultados',
            'no hay resultados',
            'no results found',
            'no se encontró',
            'no hay coincidencias',
        ];

        const hasNoResults = noResultsIndicators.some(indicator => pageText.includes(indicator));
        if (hasNoResults) {
            console.log('ℹ️ [AGROCOSTA] Page indicates no results found');
            return {
                originCode: this.originCode,
                originName: this.originName,
                searchTerm,
                products: [],
                metadata: {
                    totalFound: 0,
                },
            };
        }

        // Look for inventory table or product results
        // Common selectors for inventory/results tables
        const possibleSelectors = [
            'table tbody tr',
            '.table tbody tr',
            '.inventario tbody tr',
            '.resultados tbody tr',
            '[class*="inventario"] tbody tr',
            '[class*="resultado"] tbody tr',
            'table tr', // Fallback: any table row
            'tbody tr', // Fallback: any tbody row
        ];

        let rows: any = null;
        for (const selector of possibleSelectors) {
            rows = $(selector);
            if (rows.length > 0) {
                console.log(`🔍 [AGROCOSTA] Found ${rows.length} rows using selector: "${selector}"`);
                break;
            }
        }

        // If no table found, try alternative structures
        if (!rows || rows.length === 0) {
            console.log('⚠️ [AGROCOSTA] No table rows found, trying alternative structures...');
            // Try to find any product-like divs or list items
            const productDivs = $('[class*="product"], [class*="item"], [class*="result"], [class*="inventario"]');
            if (productDivs.length > 0) {
                console.log(`🔍 [AGROCOSTA] Found ${productDivs.length} product-like divs`);
                productDivs.each((_index: number, element: any) => {
                    const product = this.extractProductFromDiv($, $(element), searchTerm);
                    if (product) products.push(product);
                });
            } else {
                console.warn('⚠️ [AGROCOSTA] No product elements found in HTML');
                console.warn('⚠️ [AGROCOSTA] HTML preview (first 2000 chars):', html.substring(0, 2000));
            }
        } else {
            // Parse table rows - skip header row if present
            console.log(`🔍 [AGROCOSTA] Processing ${rows.length} table rows`);
            rows.each((_index: number, row: any) => {
                // Skip header rows (usually contain "Referencia", "Descripción", etc.)
                const rowText = $(row).text().toLowerCase();
                if (rowText.includes('referencia') || rowText.includes('descripción') || rowText.includes('cantidad') || rowText.includes('precio')) {
                    return; // Skip header row
                }

                const product = this.extractProductFromRow($, $(row), searchTerm);
                if (product) {
                    products.push(product);
                    console.log(`✅ [AGROCOSTA] Product extracted: ${product.reference} - Stock: ${product.stock}`);
                }
            });
        }

        console.log(`✅ [AGROCOSTA] Parsed ${products.length} products`);

        return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products,
            metadata: {
                totalFound: products.length,
            },
        };
    }

    /**
     * Extract product data from a table row
     */
    private extractProductFromRow($: any, $row: any, searchTerm: string): Product | null {
        const cells = $row.find('td');
        if (cells.length === 0) return null;

        // Try to extract reference from different column positions
        let reference = '';
        let description = '';
        let price = 0;
        let stock = 0;
        let location = '';

        // Common table structure patterns:
        // Pattern 1: Reference | Description | Price | Stock | Location
        // Pattern 2: Reference | Description | Stock
        // Pattern 3: Description | Reference | Stock | Price

        cells.each((index: number, cell: any) => {
            const text = $(cell).text().trim();
            const cellText = text.toUpperCase();

            // Try to identify reference column (usually contains the search term or alphanumeric code)
            if (!reference && (cellText.includes(searchTerm.toUpperCase()) || /^[A-Z0-9]{3,}$/.test(cellText))) {
                reference = this.normalizeReference(text);
            }

            // Try to identify description
            if (!description && text.length > 10 && !/^\d+$/.test(text)) {
                description = text;
            }

            // Try to identify price (contains currency symbols or decimal numbers)
            if (!price && (/[\$,\d]/.test(text) && text.match(/\d+[.,]\d+/))) {
                price = this.extractNumber(text);
            }

            // Try to identify stock (integer numbers)
            if (stock === 0 && /^\d+$/.test(text)) {
                const num = parseInt(text, 10);
                if (num >= 0 && num <= 10000) {
                    stock = num;
                }
            }

            // Try to identify location
            if (!location && text.length > 0 && text.length < 50 && !/^\d+$/.test(text)) {
                location = text;
            }
        });

        // If no reference found, use search term
        if (!reference) {
            reference = this.normalizeReference(searchTerm);
        }

        // If still no reference, skip this row
        if (!reference) return null;

        return this.createProduct({
            reference,
            description: description || undefined,
            price: price > 0 ? price : undefined,
            stock,
            hasStock: stock > 0,
            location: location || undefined,
            origin: this.originCode,
        });
    }

    /**
     * Extract product data from a div/list item structure
     */
    private extractProductFromDiv($: any, $item: any, searchTerm: string): Product | null {
        // Try common selectors for product information
        const referenceText = this.extractText($item, '[class*="referencia"], [class*="code"], .reference, .codigo');
        const descriptionText = this.extractText($item, '[class*="descripcion"], [class*="description"], .descripcion, .description');
        const priceText = this.extractText($item, '[class*="precio"], [class*="price"], .precio, .price');
        const stockText = this.extractText($item, '[class*="stock"], [class*="cantidad"], [class*="disponible"], .stock, .cantidad');

        const reference = referenceText || this.normalizeReference(searchTerm);
        if (!reference) return null;

        const price = priceText ? this.extractNumber(priceText) : undefined;
        const stock = stockText ? this.extractNumber(stockText) : 0;

        return this.createProduct({
            reference: this.normalizeReference(reference),
            description: descriptionText || undefined,
            price: price && price > 0 ? price : undefined,
            stock,
            hasStock: stock > 0,
            origin: this.originCode,
        });
    }
}

