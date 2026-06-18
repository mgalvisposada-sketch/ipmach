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

        // Look for the main inventory table (tablaPrincipal)
        // Structure: table#tablaPrincipal with columns: Referencia | Descripción | Bodega BARRANQUILLA | Bodega BOGOTÁ | Precio Antes de IVA
        let rows: any = null;
        
        // First, try to find the specific table by ID
        const mainTable = $('#tablaPrincipal');
        if (mainTable.length > 0) {
            rows = mainTable.find('tbody tr');
            if (rows.length > 0) {
                console.log(`🔍 [AGROCOSTA] Found ${rows.length} rows in table#tablaPrincipal`);
            }
        }
        
        // If not found, try other table selectors
        if (!rows || rows.length === 0) {
            const possibleSelectors = [
                'table.modern-table tbody tr',
                'table.table tbody tr',
                'table tbody tr',
                '.table tbody tr',
                'tbody tr',
            ];

            for (const selector of possibleSelectors) {
                rows = $(selector);
                if (rows.length > 0) {
                    console.log(`🔍 [AGROCOSTA] Found ${rows.length} rows using selector: "${selector}"`);
                    break;
                }
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
                if (rowText.includes('referencia') || rowText.includes('descripción') || rowText.includes('bodega') || rowText.includes('precio')) {
                    return; // Skip header row
                }

                const product = this.extractProductFromRow($, $(row), searchTerm);
                if (product) {
                    products.push(product);
                    console.log(`✅ [AGROCOSTA] Product extracted: ${product.reference} - Stock: ${product.stock} - Price: ${product.price}`);
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
     * Expected structure for tablaPrincipal:
     * Column 0: Referencia
     * Column 1: Descripción
     * Column 2: Bodega BARRANQUILLA (stock)
     * Column 3: Bodega BOGOTÁ (stock)
     * Column 4: Precio Antes de IVA
     */
    private extractProductFromRow($: any, $row: any, searchTerm: string): Product | null {
        const cells = $row.find('td');
        if (cells.length === 0) return null;

        // Check if this is the tablaPrincipal structure (5 columns)
        const isTablaPrincipal = cells.length >= 5;
        
        let reference = '';
        let description = '';
        let price = 0;
        let stock = 0;
        let stockBarranquilla = 0;
        let stockBogota = 0;
        let location = '';

        if (isTablaPrincipal) {
            // Standard tablaPrincipal structure
            // Column 0: Referencia
            const refCell = $(cells[0]);
            reference = this.normalizeReference(refCell.text().trim());
            
            // Column 1: Descripción
            if (cells.length > 1) {
                description = $(cells[1]).text().trim();
            }
            
            // Column 2: Bodega BARRANQUILLA (stock)
            if (cells.length > 2) {
                const stockText = $(cells[2]).text().trim();
                stockBarranquilla = this.extractNumber(stockText);
            }
            
            // Column 3: Bodega BOGOTÁ (stock)
            if (cells.length > 3) {
                const stockText = $(cells[3]).text().trim();
                stockBogota = this.extractNumber(stockText);
            }
            
            // Column 4: Precio Antes de IVA (Price Before IVA)
            if (cells.length > 4) {
                const priceText = $(cells[4]).text().trim();
                console.log(`🔍 [AGROCOSTA] Price text from column 4: "${priceText}"`);
                price = this.extractPrice(priceText);
                console.log(`🔍 [AGROCOSTA] Extracted price: ${price}`);
            }
            
            // Sum stock from both warehouses (quantity)
            stock = stockBarranquilla + stockBogota;
            
            // Set location if stock is in specific warehouse
            if (stockBarranquilla > 0 && stockBogota > 0) {
                location = 'BARRANQUILLA, BOGOTÁ';
            } else if (stockBarranquilla > 0) {
                location = 'BARRANQUILLA';
            } else if (stockBogota > 0) {
                location = 'BOGOTÁ';
            }
            
            console.log(`✅ [AGROCOSTA] Extracted product: ${reference}`);
            console.log(`   Description: ${description}`);
            console.log(`   Quantity (Stock): ${stock} (BARRANQUILLA: ${stockBarranquilla}, BOGOTÁ: ${stockBogota})`);
            console.log(`   Cost (Price): ${price}`);
            console.log(`   Location: ${location || 'N/A'}`);
        } else {
            // Fallback: Try to extract from different column positions (legacy structure)
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
        }

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
     * Extract price from text, handling Colombian and US number formats
     * Examples: "$5,275,173.00", "$1.234.567,89", "$1234567.00"
     */
    private extractPrice(priceText: string): number {
        if (!priceText) return 0;
        
        // Remove currency symbols and spaces
        let cleaned = priceText.replace(/[$€£¥\s]/g, '').trim();
        
        // Check if it's Colombian format (periods for thousands, comma for decimal)
        // Example: "5.275.173,00" or "1.234.567,89"
        if (cleaned.includes(',') && cleaned.match(/\d+\.\d+\.\d+,/)) {
            // Colombian format: replace periods with nothing, comma with period
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // US format or simple format: remove commas (thousands separators)
            cleaned = cleaned.replace(/,/g, '');
        }
        
        const price = parseFloat(cleaned) || 0;
        
        console.log(`🔍 [AGROCOSTA] Price extraction: "${priceText}" -> "${cleaned}" -> ${price}`);
        
        return price;
    }

    /**
     * Extract product data from a div/list item structure
     */
    private extractProductFromDiv($: any, $item: any, searchTerm: string): Product | null {
        // Try common selectors for product information
        // Note: $item is already a Cheerio element, so we use .find() instead of extractText
        const referenceText = $item.find('[class*="referencia"], [class*="code"], .reference, .codigo').first().text().trim();
        const descriptionText = $item.find('[class*="descripcion"], [class*="description"], .descripcion, .description').first().text().trim();
        const priceText = $item.find('[class*="precio"], [class*="price"], .precio, .price').first().text().trim();
        const stockText = $item.find('[class*="stock"], [class*="cantidad"], [class*="disponible"], .stock, .cantidad').first().text().trim();

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

