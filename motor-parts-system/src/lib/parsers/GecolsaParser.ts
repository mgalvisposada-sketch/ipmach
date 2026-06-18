import { BaseParser } from './BaseParser';
import { ParseResult, Product } from './types';

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
    const $ = this.loadCheerio(html);
    const products: Product[] = [];

    // Check if we got redirected to registration/login page
    if (html.includes('Iniciar sesión') || 
        html.includes('Welcome to Cat') || 
        html.includes('register.cat.com') ||
        html.includes('Sign Up') ||
        html.includes('Iniciar sesión')) {
      console.warn(`Gecolsa: Redirected to registration page for ${searchTerm}`);
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

    // Look for product cards or search results
    // Common selectors for Cat parts pages
    const possibleSelectors = [
      '.product-card',
      '.product-item',
      '.search-result-item',
      '[data-product-id]',
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

    let productElements: any = null;
    for (const selector of possibleSelectors) {
      productElements = $(selector);
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} elements with selector: ${selector}`);
        break;
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
    if (productElements.length === 0) {
      // Look for divs containing the search term
      productElements = $('div').filter((_, el) => {
        const text = $(el).text().toUpperCase();
        return text.includes(searchTerm.toUpperCase()) && text.length < 500; // Reasonable size
      });
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} divs containing search term`);
      }
    }

    // Try generic list items
    if (productElements.length === 0) {
      productElements = $('ul li, ol li').filter((_, el) => {
        const text = $(el).text().toUpperCase();
        return text.includes(searchTerm.toUpperCase()) || /^[A-Z0-9]{3,}$/.test(text.trim());
      });
      if (productElements.length > 0) {
        console.log(`Gecolsa: Found ${productElements.length} list items`);
      }
    }

    if (productElements.length > 0) {
      productElements.each((_index: number, element: any) => {
        const product = this.extractProduct($, $(element), searchTerm);
        if (product) products.push(product);
      });
    } else {
      console.warn(`Gecolsa: No product elements found in HTML. Content length: ${html.length}, preview: ${html.substring(0, 500)}`);
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
    // Try to find reference/part number
    const referenceText = 
      this.extractText($item, '[data-part-number], .part-number, .partNumber, .reference, .sku, [class*="part-number"], [class*="partnumber"]') ||
      this.extractText($item, 'h2, h3, h4, .title, .name, .product-title') ||
      $item.text().match(/\b([A-Z0-9]{4,})\b/)?.[1] ||
      searchTerm.toUpperCase();

    const reference = this.normalizeReference(referenceText);
    if (!reference) return null;

    // Extract description
    const description = 
      this.extractText($item, '.description, .product-description, .part-description, [class*="description"]') ||
      this.extractText($item, 'p, .details, .info') ||
      undefined;

    // Extract price
    const priceText = 
      this.extractText($item, '.price, .cost, [class*="price"], [data-price]') ||
      this.extractText($item, '[class*="cost"]');
    const price = priceText ? this.extractNumber(priceText) : undefined;

    // Extract stock/availability
    const stockText = 
      this.extractText($item, '.stock, .availability, .quantity, [class*="stock"], [class*="available"]');
    
    let stock = 0;
    let hasStock = false;

    if (stockText) {
      // Check if it indicates availability
      const lowerText = stockText.toLowerCase();
      if (lowerText.includes('disponible') || lowerText.includes('en stock') || lowerText.includes('available')) {
        hasStock = true;
        // Try to extract number
        const numMatch = stockText.match(/\d+/);
        stock = numMatch ? parseInt(numMatch[0], 10) : 1;
      } else if (lowerText.includes('sin stock') || lowerText.includes('no disponible') || lowerText.includes('unavailable')) {
        hasStock = false;
        stock = 0;
      } else {
        // Try to parse as number
        stock = this.extractNumber(stockText);
        hasStock = stock > 0;
      }
    }

    // Extract link
    const link = 
      $item.find('a').first().attr('href') || 
      $item.find('[href]').first().attr('href') || 
      undefined;

    // Extract image
    const imageUrl = 
      $item.find('img').first().attr('src') ||
      $item.find('img').first().attr('data-src') ||
      undefined;

    // Extract brand (usually Caterpillar for Gecolsa)
    const brand = 'Caterpillar';

    return this.createProduct({
      reference,
      description,
      price: price && price > 0 ? price : undefined,
      stock,
      hasStock,
      imageUrl,
      link: link?.startsWith('http') ? link : link ? `https://parts.cat.com${link}` : undefined,
      brand,
      origin: this.originCode,
    });
  }
}

