import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';
import * as cheerio from 'cheerio';

/**
 * Parser for Servitractor (empresaservitractor.zohocreatorportal.com)
 * Handles JSON responses from Zoho Creator portal
 */
export class ServitractorParser extends BaseParser {
  readonly originCode = 'SERVITRACTOR';
  readonly originName = 'Servitractor';

  canParse(content: string | object): boolean {
    // Check for JSON response
    if (typeof content === 'object' && content !== null) {
      const hasModel = 'MODEL' in content;
      const hasDataArray = (content as any).MODEL?.DATAJSONARRAY !== undefined;
      const hasHtml = 'HTML' in content;

      // If it has MODEL with DATAJSONARRAY, it's definitely Servitractor
      if (hasModel && hasDataArray) {
        return true;
      }

      // If it has HTML and MODEL, it might be Servitractor
      if (hasHtml && hasModel) {
        return true;
      }
    }

    if (typeof content === 'string') {
      const trimmed = content.trim();

      // Check if it's JSON string from Servitractor
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          return (
            ('HTML' in parsed || 'MODEL' in parsed) &&
            parsed.MODEL?.DATAJSONARRAY !== undefined
          );
        } catch {
          // If JSON parsing fails, check if it contains Servitractor markers
        }
      }

      // Check for HTML from Zoho Creator or embedded JSON
      const hasServitractorMarkers =
        content.includes('zohocreatorportal.com') ||
        content.includes('servitractor') ||
        content.includes('empresaservitractor');

      const hasJsonStructure =
        content.includes('"MODEL"') ||
        content.includes('MODEL') ||
        content.includes('"DATAJSONARRAY"') ||
        content.includes('DATAJSONARRAY');

      // If it has Servitractor markers and JSON structure, it's likely Servitractor
      if (hasServitractorMarkers && hasJsonStructure) {
        return true;
      }

      // Also check if it's just HTML with Servitractor markers
      if (hasServitractorMarkers && content.length > 100) {
        return true;
      }
    }

    return false;
  }

  async parse(content: string | object, searchTerm: string): Promise<ParseResult> {
    console.log('🔍 [SERVITRACTOR] Starting parse for searchTerm:', searchTerm);
    console.log('🔍 [SERVITRACTOR] Content type:', typeof content);

    // Convert content to string if needed
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);

    let data: any;

    // First, check if content contains HTML tiles (zc-pb-tile-container)
    if (typeof content === 'string' && content.includes('zc-pb-tile-container')) {
      console.log('🔍 [SERVITRACTOR] Detected HTML tile structure, parsing tiles directly');
      return this.parseHtmlTiles(content, searchTerm);
    }

    // Parse JSON if string
    if (typeof content === 'string') {
      console.log('🔍 [SERVITRACTOR] Content is string, length:', content.length);
      console.log('🔍 [SERVITRACTOR] Content preview (first 500 chars):', content.substring(0, 500));

      const trimmed = content.trim();

      // Check if it's HTML (login page or HTML with embedded JSON)
      const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<!--');
      const hasJsonStructure = trimmed.includes('"MODEL"') && trimmed.includes('"DATAJSONARRAY"');
      const startsWithJson = trimmed.startsWith('{') || trimmed.startsWith('[');

      let jsonString = trimmed;

      // If it starts with {, it might be valid JSON already (even if mixed with HTML after)
      if (startsWithJson && !isHtml) {
        // Try to parse it directly first
        try {
          // If it's a valid JSON string, parse it
          const testParse = JSON.parse(trimmed);
          jsonString = trimmed;
          console.log('🔍 [SERVITRACTOR] Content is valid JSON string, parsing directly');
        } catch {
          // If direct parse fails, continue with extraction logic
        }
      }

      // If it's HTML or doesn't start with {, try to extract JSON from it
      if (isHtml || (!startsWithJson && hasJsonStructure)) {
        console.log('🔍 [SERVITRACTOR] Content appears to be HTML or has embedded JSON, extracting...');

        // First, check if the entire string is a valid JSON object (even if mixed with HTML)
        // Pattern 1: Try to find the complete JSON object starting with {"HTML"
        let jsonMatch = trimmed.match(/\{"HTML":[\s\S]*?"MODEL":\{[\s\S]*?"DATAJSONARRAY":[\s\S]*?\}[\s\S]*?\}/);

        // Pattern 2: If not found, try to find any JSON object starting with {
        if (!jsonMatch) {
          // Look for the first { that likely starts the JSON object
          const firstBrace = trimmed.indexOf('{');
          if (firstBrace !== -1) {
            // Try to find the matching closing brace by counting braces
            let braceCount = 0;
            let endIndex = -1;

            for (let i = firstBrace; i < trimmed.length; i++) {
              if (trimmed[i] === '{') {
                braceCount++;
              } else if (trimmed[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  endIndex = i + 1;
                  break;
                }
              }
            }

            if (endIndex > firstBrace) {
              const candidate = trimmed.substring(firstBrace, endIndex);
              // Verify it contains the expected structure
              if (candidate.includes('"MODEL"') && candidate.includes('"DATAJSONARRAY"')) {
                jsonMatch = [candidate];
              }
            }
          }
        }

        if (jsonMatch) {
          jsonString = jsonMatch[0];
          console.log('🔍 [SERVITRACTOR] Extracted JSON, length:', jsonString.length);
          console.log('🔍 [SERVITRACTOR] Extracted JSON preview (first 500 chars):', jsonString.substring(0, 500));
        } else {
          console.warn('⚠️ [SERVITRACTOR] Could not extract JSON from HTML/content');
          // Check if it's a login page (no JSON available)
          if (isHtml && (trimmed.includes('MES Login') || trimmed.includes('<title>MES Login</title>') ||
            (trimmed.includes('zohocreatorportal.com') && trimmed.includes('login') && !hasJsonStructure))) {
            console.error('❌ [SERVITRACTOR] Received login page - cookies may have expired');
            return {
              originCode: this.originCode,
              originName: this.originName,
              searchTerm,
              products: [],
              metadata: {
                totalFound: 0,
                error: 'Received login page - cookies may have expired or authentication failed. Please update cookies in the endpoint configuration.',
              },
            };
          }
          // If we can't extract JSON and it's not a login page, try parsing HTML tiles
          if (!trimmed.startsWith('{') && trimmed.includes('zc-pb-tile-container')) {
            console.log('🔍 [SERVITRACTOR] Attempting to parse HTML tiles from response');
            return this.parseHtmlTiles(content, searchTerm);
          }
        }
      }

      // Try to parse the JSON
      try {
        // If it doesn't start with { or [, it might not be valid JSON
        if (!jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
          throw new Error('Content does not appear to be valid JSON');
        }

        data = JSON.parse(jsonString);
        console.log('✅ [SERVITRACTOR] Successfully parsed JSON');
      } catch (error: any) {
        console.error('❌ [SERVITRACTOR] Failed to parse JSON:', error.message);
        console.error('❌ [SERVITRACTOR] Content that failed to parse (first 1000 chars):', jsonString.substring(0, 1000));
        console.error('❌ [SERVITRACTOR] Is HTML?', isHtml);
        console.error('❌ [SERVITRACTOR] Has JSON structure?', hasJsonStructure);

        // Check if it's a login page
        if (trimmed.includes('MES Login') || trimmed.includes('zohocreatorportal.com') || trimmed.includes('login')) {
          return {
            originCode: this.originCode,
            originName: this.originName,
            searchTerm,
            products: [],
            metadata: {
              totalFound: 0,
              error: 'Received login page - cookies may have expired or authentication failed',
            },
          };
        }

        // Try parsing HTML tiles as fallback
        if (trimmed.includes('zc-pb-tile-container')) {
          console.log('🔍 [SERVITRACTOR] Attempting to parse HTML tiles as fallback');
          return this.parseHtmlTiles(content, searchTerm);
        }

        // If we can't parse, return empty result
        return {
          originCode: this.originCode,
          originName: this.originName,
          searchTerm,
          products: [],
          metadata: {
            totalFound: 0,
            error: `Invalid JSON response: ${error.message}`,
          },
        };
      }
    } else {
      console.log('🔍 [SERVITRACTOR] Content is already object');
      data = content;
    }

    // Log structure
    console.log('🔍 [SERVITRACTOR] Data keys:', Object.keys(data || {}));
    console.log('🔍 [SERVITRACTOR] Has MODEL?', !!data?.MODEL);
    console.log('🔍 [SERVITRACTOR] Has HTML?', !!data?.HTML);

    const products: Product[] = [];

    // Extract data from MODEL.DATAJSONARRAY
    // Try multiple paths to find the data
    let dataArray: any[] = [];

    if (data?.MODEL?.DATAJSONARRAY) {
      dataArray = Array.isArray(data.MODEL.DATAJSONARRAY) ? data.MODEL.DATAJSONARRAY : [];
    } else if (data?.DATAJSONARRAY) {
      dataArray = Array.isArray(data.DATAJSONARRAY) ? data.DATAJSONARRAY : [];
    } else if (Array.isArray(data)) {
      // Sometimes the response is directly an array
      dataArray = data;
    }

    console.log('🔍 [SERVITRACTOR] DATAJSONARRAY type:', Array.isArray(dataArray) ? 'array' : typeof dataArray);
    console.log('🔍 [SERVITRACTOR] DATAJSONARRAY length:', Array.isArray(dataArray) ? dataArray.length : 'N/A');

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      console.warn('⚠️ [SERVITRACTOR] No data found in DATAJSONARRAY');

      // Check if the response contains "no results" messages
      const hasNoResultsMessage =
        contentString.includes('No se encontraron resultados') ||
        contentString.includes('no se encontraron resultados') ||
        contentString.includes('No hay datos disponibles') ||
        contentString.includes('no hay datos disponibles') ||
        contentString.includes('La búsqueda no encontró productos coincidentes') ||
        (data?.HTML && typeof data.HTML === 'string' && (
          data.HTML.includes('No se encontraron resultados') ||
          data.HTML.includes('no se encontraron resultados') ||
          data.HTML.includes('No hay datos disponibles')
        ));

      if (hasNoResultsMessage) {
        console.log('⚠️ [SERVITRACTOR] "No results" message detected');
      }

      console.warn('⚠️ [SERVITRACTOR] Full data structure:', JSON.stringify(data || {}, null, 2).substring(0, 2000));
      return {
        originCode: this.originCode,
        originName: this.originName,
        searchTerm,
        products: [],
        metadata: {
          totalFound: 0,
          error: 'No data available in response',
          rawResponse: data,
        },
      };
    }

    console.log('✅ [SERVITRACTOR] Processing', dataArray.length, 'items');

    // Process each item in the array
    dataArray.forEach((item: any, index: number) => {
      try {
        console.log(`🔍 [SERVITRACTOR] Processing item ${index + 1}/${dataArray.length}`);
        console.log(`🔍 [SERVITRACTOR] Item keys:`, Object.keys(item));

        // Extract reference (Código)
        const reference = item.C_digo || item['C_digo'] || '';
        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Reference:`, reference);

        if (!reference) {
          console.warn(`⚠️ [SERVITRACTOR] Item ${index + 1} missing reference. Item:`, JSON.stringify(item).substring(0, 200));
          return;
        }

        // Extract description (Nombre)
        const description = item.Nombre || item['Nombre'] || '';
        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Description:`, description.substring(0, 50));

        // Extract stock (Stock)
        const stockText = item.Stock || item['Stock'] || item.zc_Stock_search || '0';
        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Stock text:`, stockText);
        const stock = this.extractNumber(stockText.toString());
        const hasStock = stock > 0;
        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Stock parsed:`, stock, 'hasStock:', hasStock);

        // Extract price - ALWAYS use price WITHOUT IVA
        // Priority: 1. Precio antes de IVA / Precio sin IVA (explicit fields)
        //           2. zc_Precio_search (usually price without IVA)
        //           3. Precio (fallback, but may include IVA)
        let priceText = item['Precio antes de IVA'] ||
          item['Precio sin IVA'] ||
          item['Precio_antes_de_IVA'] ||
          item['Precio_sin_IVA'] ||
          item.zc_Precio_search ||
          item.Precio ||
          item['Precio'] ||
          '0';

        // If we have both "Precio antes de IVA" and "Precio mas IVA", log warning
        if (item['Precio mas IVA'] || item['Precio con IVA'] || item['Precio_mas_IVA'] || item['Precio_con_IVA']) {
          console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Found price with IVA field, ensuring we use price WITHOUT IVA`);
        }

        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Price text (WITHOUT IVA):`, priceText);

        // Parse price handling Colombian/European format:
        // Format: "37.947,08" = 37947.08 (dot = thousands separator, comma = decimal)
        // Or unformatted: "37947.08" or "37947,08"
        let price = 0;
        if (priceText) {
          const priceStr = priceText.toString().trim();

          // Check if we have unformatted value (zc_Precio_search or explicit price without IVA fields)
          const unformattedPriceWithoutIva = item['Precio antes de IVA'] ||
            item['Precio sin IVA'] ||
            item['Precio_antes_de_IVA'] ||
            item['Precio_sin_IVA'] ||
            item.zc_Precio_search;

          if (unformattedPriceWithoutIva && !isNaN(parseFloat(unformattedPriceWithoutIva.toString()))) {
            // Use unformatted value directly (price without IVA)
            price = parseFloat(unformattedPriceWithoutIva.toString());
            console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Using unformatted price WITHOUT IVA:`, price);
          } else {
            // Parse formatted price (e.g., "37.947,08" or "$ 37.947,08")
            // Remove currency symbols and spaces
            let cleanPrice = priceStr.replace(/[$\s]/g, '');

            // Check format: if contains both dot and comma, it's likely European format
            // Format detection: "37.947,08" vs "37,947.08" vs "37947.08"
            if (cleanPrice.includes('.') && cleanPrice.includes(',')) {
              // Determine which is thousands and which is decimal
              const lastDotIndex = cleanPrice.lastIndexOf('.');
              const lastCommaIndex = cleanPrice.lastIndexOf(',');

              if (lastCommaIndex > lastDotIndex) {
                // European format: "37.947,08" (dot = thousands, comma = decimal)
                cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
              } else {
                // US format: "37,947.08" (comma = thousands, dot = decimal)
                cleanPrice = cleanPrice.replace(/,/g, '');
              }
            } else if (cleanPrice.includes(',')) {
              // Only comma: could be "37947,08" (European decimal)
              cleanPrice = cleanPrice.replace(',', '.');
            }
            // If only dot or no separators, parse as-is

            price = parseFloat(cleanPrice) || 0;
            console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Parsed formatted price:`, cleanPrice, '→', price);
          }
        }

        console.log(`🔍 [SERVITRACTOR] Item ${index + 1} - Final price:`, price);

        // Extract record ID for potential link
        const recordId = item.zohoRecId || item.ID || item.unformattedID || '';
        const link = recordId
          ? `https://empresaservitractor.zohocreatorportal.com/digital_servitractor/modulo-empresarial-servitracotr/report/Art_culos_Report#4797307000000027061/${recordId}`
          : undefined;

        const product = {
          reference: this.normalizeReference(reference),
          description: description || undefined,
          price: price > 0 ? price : undefined,
          stock,
          hasStock,
          location: 'Servitractor',
          origin: this.originCode,
          link,
          rawData: {
            recordId,
            nombre: description,
            precioFormateado: item.Precio || item['Precio'],
          },
        };

        console.log(`✅ [SERVITRACTOR] Item ${index + 1} - Product created:`, {
          reference: product.reference,
          description: product.description?.substring(0, 30),
          price: product.price,
          stock: product.stock,
          hasStock: product.hasStock,
        });

        products.push(product);
      } catch (error: any) {
        console.error(`❌ [SERVITRACTOR] Error processing item ${index + 1}:`, error.message);
        console.error(`❌ [SERVITRACTOR] Item data:`, JSON.stringify(item).substring(0, 500));
      }
    });

    console.log(`✅ [SERVITRACTOR] Parse complete. Total products:`, products.length);
    console.log(`✅ [SERVITRACTOR] Products summary:`, products.map(p => ({
      reference: p.reference,
      price: p.price,
      stock: p.stock,
      hasStock: p.hasStock,
    })));

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
   * Parse HTML tiles structure (zc-pb-tile-container)
   * Extracts product data from Zoho Creator tile cards
   */
  private parseHtmlTiles(html: string, searchTerm: string): ParseResult {
    console.log('🔍 [SERVITRACTOR] Parsing HTML tiles structure');
    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    // Find all tile cards that contain product data
    // Products can have two structures:
    // 1. Full structure with labels (Código, Descripción, etc.) - panel_3
    // 2. Compact structure without labels, just values - panel_4, panel_5
    const allTileCards = $('.zc-pb-tile-container .zc-pb-tile-card');
    console.log(`🔍 [SERVITRACTOR] Found ${allTileCards.length} total tile cards`);

    // Filter to only product tiles - they contain variable spans with product data
    // Skip tiles that are just headers/buttons (like "Resultados para" or "Volver a panel")
    const productTiles = allTileCards.filter((_, card) => {
      const $card = $(card);
      // Product tiles have variable spans with product data
      // They should have at least one variable span that looks like a reference (contains numbers/letters)
      const variableSpans = $card.find('span[texttype="variable"] span[text="true"][value]');
      
      // Skip tiles that are just headers (contain "Resultados para" or similar)
      const hasHeaderText = $card.text().includes('Resultados para') || 
                           $card.text().includes('Volver a panel');
      if (hasHeaderText) {
        return false;
      }
      
      // Product tiles should have multiple variable spans (reference, description, stock, price)
      // At least 3 variable spans indicates it's likely a product tile
      return variableSpans.length >= 3;
    });

    console.log(`🔍 [SERVITRACTOR] Found ${productTiles.length} product tile cards`);

    if (productTiles.length === 0) {
      console.warn('⚠️ [SERVITRACTOR] No product tile cards found in HTML');
      return this.emptyResult(searchTerm);
    }

    // Process each product tile card
    productTiles.each((index, cardElement) => {
      try {
        const $card = $(cardElement);
        console.log(`🔍 [SERVITRACTOR] Processing product tile card ${index + 1}/${productTiles.length}`);

        let reference = '';
        let description = '';
        let stock = 0;
        let price = 0;

        // Check if this tile has labels (full structure) or not (compact structure)
        const labelSpans = $card.find('span[texttype="Text"]');
        const hasLabels = labelSpans.filter((_, span) => {
          const labelText = $(span).find('span[text="true"][value]').attr('value') || $(span).text().trim();
          return labelText === 'Código' || labelText === 'Descripción';
        }).length > 0;

        if (hasLabels) {
          // Full structure with labels - use existing logic
          console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Using full structure with labels`);
          
          labelSpans.each((_, labelSpan) => {
            const $label = $(labelSpan);
            const labelText = $label.find('span[text="true"][value]').attr('value') || $label.text().trim();

            console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Found label: "${labelText}"`);

            // Find the parent column that contains BOTH the label and value rows
            let $labelColumn = $label.closest('.zcp-col').parent().closest('.zcp-col').parent().closest('.zcp-col');

            if ($labelColumn.length === 0 || $labelColumn.attr('col-width') === undefined) {
              $labelColumn = $label.closest('[col-width]');
            }

            if ($labelColumn.length === 0) {
              return;
            }

            const $valueSpans = $labelColumn.find('span[texttype="variable"] span[text="true"][value]');

            if ($valueSpans.length > 0) {
              const value = $valueSpans.first().attr('value') || $valueSpans.first().text().trim();
              console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Label "${labelText}" => Value: "${value}"`);

              if (labelText === 'Código') {
                reference = value;
              } else if (labelText === 'Descripción') {
                description = value;
              } else if (labelText === 'Existencias') {
                stock = this.extractNumber(value);
              } else if (labelText === 'Precio antes de IVA') {
                let cleanPrice = value.replace(/[$\s]/g, '');
                if (cleanPrice.includes('.') && cleanPrice.includes(',')) {
                  const lastDotIndex = cleanPrice.lastIndexOf('.');
                  const lastCommaIndex = cleanPrice.lastIndexOf(',');
                  if (lastCommaIndex > lastDotIndex) {
                    cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
                  } else {
                    cleanPrice = cleanPrice.replace(/,/g, '');
                  }
                } else if (cleanPrice.includes(',')) {
                  cleanPrice = cleanPrice.replace(',', '.');
                }
                price = parseFloat(cleanPrice) || 0;
              }
            }
          });
        } else {
          // Compact structure without labels - extract by position
          console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Using compact structure without labels`);
          
          // Find all variable spans in order (they appear in a specific order)
          // Order in compact layout: Reference, Description, Stock, Price before IVA, Price with IVA
          // Skip spans that are inside buttons (those are button parameters, not product data)
          const dataSpans: string[] = [];
          
          $card.find('span[texttype="variable"] span[text="true"][value]').each((_, span) => {
            const $span = $(span);
            const value = $span.attr('value') || $span.text().trim();
            
            // Skip if it's inside a button (button parameters) or if it's empty
            const isInButton = $span.closest('.zc-pb-btn-type').length > 0 ||
                              $span.closest('[role="button"]').length > 0;
            
            if (!isInButton && value && value.trim()) {
              dataSpans.push(value.trim());
            }
          });
          
          console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Found ${dataSpans.length} data spans (excluding buttons)`);
          
          console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Data spans:`, dataSpans);
          
          // Extract by position
          if (dataSpans.length >= 1) {
            reference = dataSpans[0]; // First is reference
            console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Reference: ${reference}`);
          }
          if (dataSpans.length >= 2) {
            description = dataSpans[1]; // Second is description
            console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Description: ${description.substring(0, 50)}`);
          }
          if (dataSpans.length >= 3) {
            stock = this.extractNumber(dataSpans[2]); // Third is stock
            console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Stock: ${stock}`);
          }
          if (dataSpans.length >= 4) {
            // Fourth is price before IVA
            let cleanPrice = dataSpans[3].replace(/[$\s]/g, '');
            if (cleanPrice.includes('.') && cleanPrice.includes(',')) {
              const lastDotIndex = cleanPrice.lastIndexOf('.');
              const lastCommaIndex = cleanPrice.lastIndexOf(',');
              if (lastCommaIndex > lastDotIndex) {
                cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
              } else {
                cleanPrice = cleanPrice.replace(/,/g, '');
              }
            } else if (cleanPrice.includes(',')) {
              cleanPrice = cleanPrice.replace(',', '.');
            }
            price = parseFloat(cleanPrice) || 0;
            console.log(`🔍 [SERVITRACTOR] Tile ${index + 1} - Price (sin IVA): ${price}`);
          }
        }

        // Only create product if we have a reference
        if (reference) {
          const hasStock = stock > 0;

          const product = this.createProduct({
            reference,
            description: description || undefined,
            price: price > 0 ? price : undefined,
            stock,
            hasStock,
            location: 'Servitractor',
            origin: this.originCode,
          });

          console.log(`✅ [SERVITRACTOR] Tile ${index + 1} - Product created:`, {
            reference: product.reference,
            description: product.description?.substring(0, 30),
            price: product.price,
            stock: product.stock,
            hasStock: product.hasStock,
          });

          products.push(product);
        } else {
          console.warn(`⚠️ [SERVITRACTOR] Tile ${index + 1} missing reference, skipping`);
        }
      } catch (error: any) {
        console.error(`❌ [SERVITRACTOR] Error processing tile ${index + 1}:`, error.message);
      }
    });

    console.log(`✅ [SERVITRACTOR] HTML tiles parse complete. Total products: ${products.length}`);
    console.log(`✅ [SERVITRACTOR] Products summary:`, products.map(p => ({
      reference: p.reference,
      price: p.price,
      stock: p.stock,
      hasStock: p.hasStock,
    })));

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

