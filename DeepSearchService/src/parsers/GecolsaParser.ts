import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser for Gecolsa (parts.cat.com/es/gecolsa)
 * Handles HTML responses from Caterpillar parts search
 */
export class GecolsaParser extends BaseParser {
  readonly originCode = 'GECOLSA';
  readonly originName = 'Gecolsa';

  canParse(content: string | object): boolean {
    if (typeof content !== 'string') return false;

    // Check for Gecolsa-specific markers (including registration/redirect pages)
    // Accept any content from cat.com domains
    return (
      content.includes('cat.com') ||
      content.includes('parts.cat.com') ||
      content.includes('gecolsa') ||
      content.includes('caterpillar') ||
      content.includes('product-card') ||
      content.includes('part-number') ||
      content.includes('Caterpillar') ||
      content.includes('register.cat.com')
    );
  }

  async parse(html: string, searchTerm: string): Promise<ParseResult> {
    // Save HTML to file for debugging
    try {
      const debugDir = path.join(process.cwd(), 'debug-html');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.join(debugDir, `gecolsa-${searchTerm}-${timestamp}.html`);
      fs.writeFileSync(filename, html, 'utf-8');
      console.log(`📄 [GECOLSA] Saved HTML to: ${filename}`);
      console.log(`📄 [GECOLSA] HTML length: ${html.length} characters`);
    } catch (error: any) {
      console.warn(`⚠️ [GECOLSA] Failed to save HTML debug file: ${error.message}`);
    }

    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    // Note: We don't check for registration page here because "Iniciar sesión" 
    // might appear in the navigation even when products are present.
    // We'll check for registration page only if no products are found.

    // Look for product cards or search results
    // GECOLSA uses product-comparison-grid structure
    // The structure is: parent container with product-comparison-grid class containing:
    // - h2 with product-comparison-grid classes (title/reference)
    // - p with card-description class (description)
    // - div with card-price class (price)
    // - p with data-testid="availability-message" (stock)
    
    let productElements: any = null;
    
    // First, try to find parent containers that have product-comparison-grid structure
    // Look for elements that contain both card-description and card-price
    const gridContainers = $('[class*="product-comparison-grid"]').filter((_, el) => {
      const $el = $(el);
      const hasDescription = $el.find('[class*="card-description"]').length > 0;
      const hasPrice = $el.find('[class*="card-price"]').length > 0;
      const hasTitle = $el.find('h2[class*="product-comparison-grid"], h3[class*="product-comparison-grid"]').length > 0;
      return (hasDescription && hasPrice) || hasTitle;
    });
    
    if (gridContainers.length > 0) {
      productElements = gridContainers;
      console.log(`🔍 [GECOLSA] Found ${productElements.length} product-comparison-grid containers`);
    } else {
      // Also try to find h2 elements with product-comparison-grid classes and get their parent containers
      const h2Elements = $('h2[class*="product-comparison-grid"], h3[class*="product-comparison-grid"]');
      if (h2Elements.length > 0) {
        // Get parent containers that contain these h2 elements
        const parentContainers = h2Elements.map((_, el) => {
          const $el = $(el);
          // Try to find a parent that contains both description and price
          let parent = $el.parent();
          let depth = 0;
          while (parent.length > 0 && depth < 5) {
            const hasDescription = parent.find('[class*="card-description"]').length > 0;
            const hasPrice = parent.find('[class*="card-price"]').length > 0;
            if (hasDescription || hasPrice) {
              return parent[0];
            }
            parent = parent.parent();
            depth++;
          }
          // If no parent with description/price found, return the immediate parent
          return $el.parent()[0];
        }).get();
        
        if (parentContainers.length > 0) {
          productElements = $(parentContainers);
          console.log(`🔍 [GECOLSA] Found ${productElements.length} parent containers for h2 elements with product-comparison-grid classes`);
        }
      }
      
      if (!productElements || productElements.length === 0) {
        // Fallback: try to find elements that contain product-related elements
        const possibleSelectors = [
          '[class*="product-comparison-grid"]', // Primary selector for GECOLSA products
          '[class*="product-comparison"]',
          '.product-card',
          '.product-item',
          '.search-result-item',
          '[data-product-id]',
          '[data-testid*="product"]',
          '.part-card',
          '.product',
          '[class*="product"]',
          '[class*="part"]',
          'article.product',
          '[class*="result"]',
          '[class*="item"]',
          '.search-results .item',
          '.results .item',
          'div[class*="Product"]',
          'div[class*="Part"]',
        ];

        for (const selector of possibleSelectors) {
          productElements = $(selector);
          if (productElements.length > 0) {
            console.log(`Gecolsa: Found ${productElements.length} elements with selector: ${selector}`);
            break;
          }
        }
      }
    }

    // If no specific product selector found, try table rows
    if (!productElements || productElements.length === 0) {
      productElements = $('table tbody tr, .table tbody tr');
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} table rows`);
      }
    }

    // Try generic divs that might contain product info
    if (!productElements || productElements.length === 0) {
      // Look for divs containing the search term and product-related elements
      productElements = $('div').filter((_, el) => {
        const $el = $(el);
        const text = $el.text().toUpperCase();
        const hasProductElements = $el.find('[class*="card-description"], [class*="card-price"], [data-testid="availability-message"]').length > 0;
        return (text.includes(searchTerm.toUpperCase()) || hasProductElements) && text.length < 1000; // Reasonable size
      });
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} divs containing product elements`);
      }
    }

    // Try generic list items
    if (!productElements || productElements.length === 0) {
      productElements = $('ul li, ol li').filter((_, el) => {
        const text = $(el).text().toUpperCase();
        return text.includes(searchTerm.toUpperCase()) || /^[A-Z0-9]{3,}$/.test(text.trim());
      });
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} list items`);
      }
    }

    if (productElements && productElements.length > 0) {
      console.log(`🔍 [GECOLSA] Processing ${productElements.length} product elements`);
      productElements.each((index: number, element: any) => {
        const product = this.extractProduct($, $(element), searchTerm);
        if (product) {
          products.push(product);
          console.log(`✅ [GECOLSA] Product ${index + 1}: ${product.reference} - ${product.description} - Price: ${product.price} - Stock: ${product.stock}`);
        } else {
          console.warn(`⚠️ [GECOLSA] Product ${index + 1}: Failed to extract product data`);
        }
      });
      console.log(`✅ [GECOLSA] Successfully parsed ${products.length} products from ${productElements.length} elements`);
    } else {
      console.warn(`⚠️ [GECOLSA] No product elements found in HTML. Content length: ${html.length}, preview: ${html.substring(0, 500)}`);
      
      // Only check for registration page if no products were found
      // Check for specific registration page indicators (not just "Iniciar sesión" which might be in navigation)
      const isRegistrationPage = 
        html.includes('register.cat.com') ||
        (html.includes('Welcome to Cat') && html.includes('Sign Up')) ||
        ($('form[action*="register"], form[action*="signup"], form[id*="register"], form[id*="signup"]').length > 0);
      
      if (isRegistrationPage) {
        console.warn(`⚠️ [GECOLSA] Redirected to registration page for ${searchTerm}`);
        return {
          originCode: this.originCode,
          originName: this.originName,
          searchTerm,
          products: [],
          metadata: {
            totalFound: 0,
            error: 'Redirected to registration page - may require authentication',
          },
        };
      }
    }

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
   * Extract product data from an element
   */
  private extractProduct($: any, $item: any, searchTerm: string): Product | null {
    // GECOLSA structure: product-comparison-grid with title in h2 > a, description in p, price in div
    // Try to find reference/part number from title or link
    let referenceText = '';
    
    // First, try to get from title link (h2 > a) - this is the most reliable source
    const titleLink = $item.find('h2 a, h3 a, h4 a, a[href*="/parts/"], a[href*="/product/"]').first();
    if (titleLink.length > 0) {
      const linkText = titleLink.text().trim();
      const linkHref = titleLink.attr('href') || '';
      
      // Extract reference from link URL if available (e.g., /parts/1R0750)
      const urlMatch = linkHref.match(/\/(?:parts|product|es\/gecolsa\/parts)\/([A-Z0-9-]+)/i);
      if (urlMatch && urlMatch[1]) {
        referenceText = urlMatch[1].toUpperCase();
      } else {
        // Try to extract from title text - look for part number patterns
        // Part numbers are usually like: 1R0750, 1R-0750, 1R0750-1, etc.
        const refMatch = linkText.match(/\b([A-Z0-9]{1,3}[-]?[A-Z0-9]{3,}(?:[-][A-Z0-9]{1,3})?)\b/);
        if (refMatch && refMatch[1]) {
          referenceText = refMatch[1].toUpperCase();
        } else {
          // If no part number pattern found, use the full title text
          referenceText = linkText;
        }
      }
    }
    
    // Also check h2, h3, h4 directly (in case link is not inside or h2 contains reference)
    // Format: "1R-0750: Filtro de combustible secundario"
    if (!referenceText) {
      const titleElement = $item.find('h2[class*="product-comparison-grid"], h3[class*="product-comparison-grid"], h2, h3, h4').first();
      if (titleElement.length > 0) {
        const titleText = titleElement.text().trim();
        // Try to extract part number from title (format: "1R-0750: Description" or "1R0750 Description")
        // Match patterns like: 1R-0750, 1R0750, 1R-0750-1, etc.
        const refMatch = titleText.match(/^([A-Z0-9]{1,3}[-]?[A-Z0-9]{3,}(?:[-][A-Z0-9]{1,3})?)[\s:]/);
        if (refMatch && refMatch[1]) {
          referenceText = refMatch[1].toUpperCase();
        } else {
          // Try without the colon/space requirement
          const refMatch2 = titleText.match(/\b([A-Z0-9]{1,3}[-]?[A-Z0-9]{3,}(?:[-][A-Z0-9]{1,3})?)\b/);
          if (refMatch2 && refMatch2[1]) {
            referenceText = refMatch2[1].toUpperCase();
          } else {
            referenceText = titleText;
          }
        }
      }
    }
    
    // Fallback: try other selectors
    if (!referenceText) {
      const partNumberElement = $item.find('[data-part-number], .part-number, .partNumber, .reference, .sku, [class*="part-number"], [class*="partnumber"]').first();
      referenceText = 
        (partNumberElement.length > 0 ? partNumberElement.text().trim() : '') ||
        $item.text().match(/\b([A-Z0-9]{1,3}[-]?[A-Z0-9]{3,}(?:[-][A-Z0-9]{1,3})?)\b/)?.[1] ||
        searchTerm.toUpperCase();
    }

    const reference = this.normalizeReference(referenceText);
    if (!reference || reference.length < 3) {
      console.warn(`⚠️ [GECOLSA] Invalid reference extracted: "${referenceText}" (normalized: "${reference}")`);
      return null;
    }
    
    // Log extraction details for debugging
    console.log(`🔍 [GECOLSA] Extracting product - Reference: ${reference}, Search term: ${searchTerm}`);

    // Extract description from product-comparison-grid structure
    // Format: <p class="mb-0 product-comparison-grid_product-comparison__card-description__zMtvr">...</p>
    let description = '';
    
    // Priority: look for p tag with card-description class
    const descriptionElement = $item.find('p[class*="card-description"], [class*="card-description"]').first();
    if (descriptionElement.length > 0) {
      description = descriptionElement.text().trim();
    }
    
    // Fallback: try other description selectors
    if (!description) {
      const desc1 = $item.find('p.mb-0[class*="description"], p[class*="description"]').first().text().trim();
      const desc2 = $item.find('[class*="description"], .description, .product-description, .part-description').first().text().trim();
      const desc3 = $item.find('p, .details, .info').first().text().trim();
      description = desc1 || desc2 || desc3 || '';
    }
    
    // Clean up description - remove reference if it appears in description
    if (description) {
      description = description.trim();
      // Remove the reference from description if it's at the start
      if (description.toUpperCase().startsWith(reference.toUpperCase())) {
        description = description.substring(reference.length).trim();
        // Remove leading dash or colon if present
        description = description.replace(/^[-–—:\s]+/, '').trim();
      }
    }

    // Extract price from product-comparison-grid structure
    // Format: <div class="mb-0 product-comparison-grid_product-comparison__card-price__EYTbC" data-testid="conditional-price-discounted-container">
    //   <span class="product-comparison-grid_vertical-align__IwmPJ cat-u-theme-typography-label-lg">$130,878.00 </span>
    //   <span class="cat-u-theme-typography-footnote">COP</span>
    // </div>
    let price = 0;
    
    // Priority: look for div with card-price class
    const priceContainer = $item.find('[class*="card-price"], [data-testid*="price"]').first();
    if (priceContainer.length > 0) {
      // Get all text from price container (includes both spans)
      const priceText = priceContainer.text().trim();
      // Match format: $130,878.00 or 130,878.00 COP
      // Handle both formats: $130,878.00 and 130,878.00 COP
      const priceMatch = priceText.match(/\$?\s*([\d,]+(?:\.\d{2})?)/);
      if (priceMatch && priceMatch[1]) {
        const priceStr = priceMatch[1].replace(/,/g, '');
        price = parseFloat(priceStr);
      }
    }
    
    // Fallback: try other price selectors
    if (price === 0) {
      const priceElement = $item.find('[class*="price"], .price, [data-price], [class*="cost"]').first();
      const priceText = 
        (priceElement.length > 0 ? priceElement.text().trim() : '') ||
        $item.text().match(/\$\s*([\d,]+(?:\.\d{2})?)/)?.[1];
      if (priceText) {
        price = this.extractNumber(priceText);
      }
    }

    // Extract stock/availability from product-comparison-grid structure
    // Format: <p data-testid="availability-message" class="cat-u-theme-typography-label-sm mb-0 availability-message_availability-message__text__uwnRZ">Disponible</p>
    let stock = 0;
    let hasStock = false;
    
    // Priority: look for element with data-testid="availability-message"
    const availabilityElement = $item.find('[data-testid="availability-message"]').first();
    if (availabilityElement.length > 0) {
      const stockText = availabilityElement.text().trim().toLowerCase();
      if (stockText.includes('disponible') || stockText.includes('available') || stockText.includes('en stock')) {
        hasStock = true;
        // Try to extract number from the text
        const numMatch = availabilityElement.text().match(/\d+/);
        stock = numMatch ? parseInt(numMatch[0], 10) : 1; // Default to 1 if "Disponible" but no number
      } else if (stockText.includes('sin stock') || stockText.includes('no disponible') || stockText.includes('unavailable') || stockText.includes('agotado')) {
        hasStock = false;
        stock = 0;
      }
    } else {
      // Fallback: try other selectors
      const availabilityFallback = $item.find('[class*="availability-message"], [class*="availability"], .availability').first();
      if (availabilityFallback.length > 0) {
        const stockText = availabilityFallback.text().trim().toLowerCase();
        if (stockText.includes('disponible') || stockText.includes('available') || stockText.includes('en stock')) {
          hasStock = true;
          const numMatch = availabilityFallback.text().match(/\d+/);
          stock = numMatch ? parseInt(numMatch[0], 10) : 1;
        } else if (stockText.includes('sin stock') || stockText.includes('no disponible') || stockText.includes('unavailable') || stockText.includes('agotado')) {
          hasStock = false;
          stock = 0;
        }
      } else {
        // Last fallback: try generic stock selectors
        const stockElement = $item.find('.stock, .availability, .quantity, [class*="stock"], [class*="available"]').first();
        const stockText = stockElement.length > 0 ? stockElement.text().trim() : '';
        
        if (stockText) {
          const lowerText = stockText.toLowerCase();
          if (lowerText.includes('disponible') || lowerText.includes('en stock') || lowerText.includes('available')) {
            hasStock = true;
            const numMatch = stockText.match(/\d+/);
            stock = numMatch ? parseInt(numMatch[0], 10) : 1;
          } else if (lowerText.includes('sin stock') || lowerText.includes('no disponible') || lowerText.includes('unavailable') || lowerText.includes('agotado')) {
            hasStock = false;
            stock = 0;
          } else {
            stock = this.extractNumber(stockText);
            hasStock = stock > 0;
          }
        }
      }
    }

    // Extract link from title link or any link in the product
    // Priority: h2 > a link (most reliable)
    let link = titleLink.length > 0 ? titleLink.attr('href') : undefined;
    
    // Also check if h2 is wrapped in an <a> tag
    if (!link) {
      const h2Element = $item.find('h2[class*="product-comparison-grid"], h2, h3, h4').first();
      if (h2Element.length > 0) {
        // Check if h2's parent is an <a> tag
        const parentLink = h2Element.parent('a');
        if (parentLink.length > 0) {
          link = parentLink.attr('href');
        } else {
          // Check if h2 is inside an <a> tag (closest ancestor)
          const ancestorLink = h2Element.closest('a');
          if (ancestorLink.length > 0) {
            link = ancestorLink.attr('href');
          }
        }
      }
    }
    
    // Fallback: try other link selectors
    if (!link) {
      link = 
        $item.find('a[href*="/parts/"], a[href*="/product/"], a[href*="/es/gecolsa"]').first().attr('href') ||
        $item.find('h2 a, h3 a, h4 a').first().attr('href') ||
        $item.find('a').first().attr('href') || 
        $item.find('[href]').first().attr('href') || 
        undefined;
    }
    
    // Make link absolute if relative
    if (link) {
      if (link.startsWith('http://') || link.startsWith('https://')) {
        // Already absolute, use as is
      } else if (link.startsWith('/')) {
        // Absolute path, prepend domain
        link = `https://parts.cat.com${link}`;
      } else {
        // Relative path, prepend domain with slash
        link = `https://parts.cat.com/${link}`;
      }
    }

    // Extract image
    let imageUrl = 
      $item.find('img').first().attr('src') ||
      $item.find('img').first().attr('data-src') ||
      $item.find('img').first().attr('data-lazy-src') ||
      undefined;
    
    // Make image URL absolute if relative
    if (imageUrl && !imageUrl.startsWith('http')) {
      imageUrl = imageUrl.startsWith('/') 
        ? `https://parts.cat.com${imageUrl}`
        : `https://parts.cat.com/${imageUrl}`;
    }

    // Extract brand (usually Caterpillar for Gecolsa)
    const brand = 'Caterpillar';

    return this.createProduct({
      reference,
      description,
      price: price && price > 0 ? price : undefined,
      stock,
      hasStock,
      imageUrl,
      link: link || undefined,
      brand,
      origin: this.originCode,
    });
  }
}

