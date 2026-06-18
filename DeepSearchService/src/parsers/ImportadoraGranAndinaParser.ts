import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';

/**
 * Parser for Gran Andina (importadoragranandina.com)
 * This source returns a full list of products, so we search within the list
 * The list is cached and refreshed on the first request of the day
 */
export class ImportadoraGranAndinaParser extends BaseParser {
  readonly originCode = 'IMPORTADORAGRANANDINA';
  readonly originName = 'Gran Andina';

  canParse(content: string | object): boolean {
    // Check if content is the expected JSON array structure
    if (typeof content === 'object') {
      return (
        Array.isArray(content) &&
        content.length > 0 &&
        content.some((item: any) => item.value && item.value.codigo_producto)
      );
    }

    if (typeof content === 'string') {
      const trimmed = content.trim();
      
      // Check if it's HTML that might contain JSON
      const isHtml = trimmed.startsWith('<!DOCTYPE') || 
                     trimmed.startsWith('<html') || 
                     trimmed.startsWith('<!--') ||
                     (trimmed.includes('<') && trimmed.includes('>') && trimmed.includes('</'));
      
      if (isHtml) {
        // Check if HTML contains the expected JSON structure markers
        const hasJsonStructure = trimmed.includes('"codigo_producto"') || 
                                 trimmed.includes('"value"') ||
                                 trimmed.includes('codigo_producto');
        return hasJsonStructure;
      }
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(trimmed);
        return (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          parsed.some((item: any) => item.value && item.value.codigo_producto)
        );
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Search for a term within codigo_producto field
   * codigo_producto can contain multiple codes separated by spaces
   * Example: "FT1364/35B FT1364" should match "FT1364", "FT1364/35B", etc.
   * 
   * Matching rules (in order of priority):
   * 1. Exact match (e.g., "9X1439" matches "9X1439")
   * 2. Code starts with search term (e.g., "9X1439CEP" starts with "9X1439")
   * 3. Search term starts with code (e.g., "9X1439" starts with "9X1439C")
   * 4. Full code match when ignoring slashes (e.g., "FT1364" matches "FT1364/35B")
   * 
   * Avoids false positives:
   * - Won't match if search term is too short (< 4 chars) and partial match is generic
   * - Requires meaningful overlap (at least 4 consecutive chars for partial matches)
   */
  private matchesSearchTerm(codigoProducto: string, searchTerm: string): boolean {
    if (!codigoProducto || !searchTerm) return false;
    
    // Normalize search term: uppercase, trim, remove extra spaces
    const normalizedSearch = this.normalizeReference(searchTerm);
    
    // If search term is too short, only allow exact matches
    if (normalizedSearch.length < 3) {
      return false;
    }
    
    // Split codigo_producto by spaces and normalize each code
    // codigo_producto can be like "11574003B KM5147/49 KM2233" or "FT1364/35B FT1364"
    const codigos = codigoProducto
      .split(/\s+/)
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(c => this.normalizeReference(c));
    
    // Check if any code matches the search term
    for (const codigo of codigos) {
      // 1. Exact match (highest priority) - always match
      if (codigo === normalizedSearch) {
        console.log(`  ✓ [IMPORTADORAGRANANDINA] Exact match: "${codigo}" === "${normalizedSearch}"`);
        return true;
      }
      
      // 2. Code starts with search term (e.g., "9X1439CEP" starts with "9X1439")
      // This is the most common case: search for "9X1439" should match "9X1439CEP"
      // Only allow this if search term is at least 4 characters to avoid false positives
      if (normalizedSearch.length >= 4 && codigo.startsWith(normalizedSearch)) {
        console.log(`  ✓ [IMPORTADORAGRANANDINA] Prefix match: "${codigo}".startsWith("${normalizedSearch}")`);
        return true;
      }
      
      // 3. Code contains search term as a complete contiguous substring
      // Only allow if search term is at least 5 characters to avoid false positives
      // AND the match is at the start or end of the code (not in the middle randomly)
      if (normalizedSearch.length >= 5 && codigo.includes(normalizedSearch)) {
        // Check if it's at the start or end (more likely to be a real code match)
        const startIndex = codigo.indexOf(normalizedSearch);
        const isAtStart = startIndex === 0;
        const isAtEnd = startIndex + normalizedSearch.length === codigo.length;
        
        if (isAtStart || isAtEnd) {
          console.log(`  ✓ [IMPORTADORAGRANANDINA] Contains match (at start/end): "${codigo}" contains "${normalizedSearch}"`);
          return true;
        }
      }
      
      // 4. Full code match when ignoring slashes (e.g., "FT1364" matches "FT1364/35B")
      // Only if the base code matches (without the suffix) and search term is at least 4 chars
      if (normalizedSearch.length >= 4) {
        const searchWithoutSlashes = normalizedSearch.replace(/\//g, '');
        const codigoWithoutSlashes = codigo.replace(/\//g, '');
        
        // Match if base code starts with search term (e.g., "FT1364/35B" without slashes starts with "FT1364")
        if (codigoWithoutSlashes.startsWith(searchWithoutSlashes) && searchWithoutSlashes.length >= 4) {
          console.log(`  ✓ [IMPORTADORAGRANANDINA] Slash-ignored prefix match: "${codigoWithoutSlashes}".startsWith("${searchWithoutSlashes}")`);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Parse price from format "$9.751.000" (Colombian format with dot as thousands separator)
   */
  private parsePrice(priceText: string): number {
    if (!priceText) return 0;
    
    // Remove currency symbol and spaces
    let cleaned = priceText.replace(/[$\s]/g, '');
    
    // Colombian format: dots are thousands separators
    // Example: "9.751.000" = 9751000
    cleaned = cleaned.replace(/\./g, '');
    
    return parseFloat(cleaned) || 0;
  }

  /**
   * Calculate total stock from multiple location fields
   */
  private calculateStock(cantToberin: string | number, cantSexta: string | number, cantCali: string | number): number {
    const toberin = typeof cantToberin === 'string' ? parseInt(cantToberin) || 0 : (cantToberin || 0);
    const sexta = typeof cantSexta === 'string' ? parseInt(cantSexta) || 0 : (cantSexta || 0);
    const cali = typeof cantCali === 'string' ? parseInt(cantCali) || 0 : (cantCali || 0);
    
    return toberin + sexta + cali;
  }

  async parse(content: string | object, searchTerm: string): Promise<ParseResult> {
    const products: Product[] = [];
    
    // Parse JSON - handle both pure JSON and JSON embedded in HTML
    let data: any[];
    if (typeof content === 'string') {
      const trimmed = content.trim();
      
      // Check if it's HTML (starts with <html, <!DOCTYPE, or contains HTML tags)
      const isHtml = trimmed.startsWith('<!DOCTYPE') || 
                     trimmed.startsWith('<html') || 
                     trimmed.startsWith('<!--') ||
                     (trimmed.includes('<') && trimmed.includes('>') && trimmed.includes('</'));
      
      if (isHtml) {
        console.log('🔍 [IMPORTADORAGRANANDINA] Content appears to be HTML, extracting JSON...');
        
        // Try to extract JSON from HTML
        // Look for JSON array in script tags or embedded in HTML
        let jsonString = trimmed;
        let extracted = false;
        
        // Pattern 1: Look for JSON array in script tags
        const scriptMatch = trimmed.match(/<script[^>]*>[\s\S]*?(\[[\s\S]*?\])\s*<\/script>/i);
        if (scriptMatch && scriptMatch[1]) {
          jsonString = scriptMatch[1];
          extracted = true;
          console.log('🔍 [IMPORTADORAGRANANDINA] Found JSON array in script tag');
        } else {
          // Pattern 2: Look for JSON array anywhere in the HTML
          // Find the first [ that starts a JSON array (but not inside a string)
          const startIndex = trimmed.indexOf('[');
          if (startIndex !== -1) {
            // Count brackets to find the matching closing bracket
            let bracketCount = 0;
            let inString = false;
            let escapeNext = false;
            let endIndex = -1;
            
            for (let i = startIndex; i < trimmed.length; i++) {
              const char = trimmed[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if ((char === '"' || char === "'") && !escapeNext) {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '[') bracketCount++;
                if (char === ']') {
                  bracketCount--;
                  if (bracketCount === 0) {
                    endIndex = i + 1;
                    break;
                  }
                }
              }
            }
            
            if (endIndex > startIndex) {
              jsonString = trimmed.substring(startIndex, endIndex);
              extracted = true;
              console.log('🔍 [IMPORTADORAGRANANDINA] Extracted JSON array from HTML');
            }
          }
          
          // Pattern 3: If no array found, look for a single object and wrap it in an array
          if (!extracted) {
            const objectMatch = trimmed.match(/\{\s*"options"[\s\S]*?"value"[\s\S]*?\}/);
            if (objectMatch && objectMatch[0]) {
              jsonString = `[${objectMatch[0]}]`;
              extracted = true;
              console.log('🔍 [IMPORTADORAGRANANDINA] Found single object, wrapped in array');
            }
          }
        }
        
        try {
          data = JSON.parse(jsonString);
          console.log('✅ [IMPORTADORAGRANANDINA] Successfully parsed JSON from HTML');
        } catch (error: any) {
          console.error('❌ [IMPORTADORAGRANANDINA] Failed to parse JSON from HTML:', error.message);
          console.error('❌ [IMPORTADORAGRANANDINA] JSON string preview (first 500 chars):', jsonString.substring(0, 500));
          return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products: [],
            metadata: {
              error: `Failed to extract JSON from HTML: ${error.message}`,
            },
          };
        }
      } else {
        // It's not HTML, try to parse as JSON directly
        try {
          data = JSON.parse(trimmed);
        } catch (error: any) {
          console.error('❌ [IMPORTADORAGRANANDINA] Failed to parse JSON:', error.message);
          return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products: [],
            metadata: {
              error: `Invalid JSON response: ${error.message}`,
            },
          };
        }
      }
    } else {
      data = content as any[];
    }

    if (!Array.isArray(data)) {
      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products: [],
        metadata: {
          error: 'Expected array response',
        },
      };
    }

    // Search within the full list
    const normalizedSearchTerm = this.normalizeReference(searchTerm);
    console.log(`🔍 [IMPORTADORAGRANANDINA] Searching for "${searchTerm}" (normalized: "${normalizedSearchTerm}") in ${data.length} items`);
    
    let checkedCount = 0;
    let matchedCount = 0;
    
    data.forEach((item: any, index: number) => {
      try {
        const value = item.value;
        if (!value || !value.codigo_producto) {
          return;
        }

        checkedCount++;

        // Check if any code in codigo_producto matches the search term
        const matches = this.matchesSearchTerm(value.codigo_producto, searchTerm);
        if (!matches) {
          // Log why it didn't match (for debugging)
          if (checkedCount <= 10 || value.codigo_producto.includes('9X1439') || value.codigo_producto.includes('9x1439')) {
            console.log(`🔍 [IMPORTADORAGRANANDINA] No match: "${value.codigo_producto}" does not match "${searchTerm}"`);
          }
          return;
        }

        matchedCount++;
        console.log(`✅ [IMPORTADORAGRANANDINA] Match found: "${value.codigo_producto}" matches "${searchTerm}"`);

        // Extract product data
        const codigoProducto = value.codigo_producto.trim();
        const description = value.descripcion || '';
        const priceText = value.precio || '';
        const price = this.parsePrice(priceText);
        const stock = this.calculateStock(
          value.cant_toberin || 0,
          value.cant_sexta || 0,
          value.cant_cali || 0
        );
        const hasStock = stock > 0;

        // Build location string from stock locations
        const locations: string[] = [];
        if (value.cant_toberin && parseInt(value.cant_toberin.toString()) > 0) {
          locations.push(`Toberín: ${value.cant_toberin}`);
        }
        if (value.cant_sexta && parseInt(value.cant_sexta.toString()) > 0) {
          locations.push(`Sexta: ${value.cant_sexta}`);
        }
        if (value.cant_cali && parseInt(value.cant_cali.toString()) > 0) {
          locations.push(`Cali: ${value.cant_cali}`);
        }
        const location = locations.length > 0 ? locations.join(', ') : undefined;

        // Use the first code from codigo_producto as the reference
        // (codigo_producto can have multiple codes separated by spaces)
        const reference = codigoProducto.split(/\s+/)[0];

        products.push({
          reference: this.normalizeReference(reference),
          description: description || undefined,
          price: price > 0 ? price : undefined,
          stock,
          hasStock,
          location,
          origin: this.originCode,
          rawData: {
            codigo_producto: codigoProducto,
            ___id___: value.___id___,
            allCodes: codigoProducto.split(/\s+/),
          },
        });
      } catch (error: any) {
        console.error(`❌ [IMPORTADORAGRANANDINA] Error processing item ${index + 1}:`, error.message);
      }
    });

    console.log(`✅ [IMPORTADORAGRANANDINA] Search completed: ${matchedCount} matches out of ${checkedCount} items checked, ${products.length} products created`);

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
}

