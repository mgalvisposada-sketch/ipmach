/**
 * Utility to extract structured data from SERVITRACTOR and RETROTRAC responses using OpenAI
 */

interface OpenAIConfig {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ExtractionResult {
  products: Array<{
    reference: string;
    description?: string;
    price?: number;
    stock?: number;
    hasStock: boolean;
  }>;
  error?: string;
}

/**
 * Extract product information from SERVITRACTOR HTML/JSON response using OpenAI
 */
export async function extractServitractorData(
  content: string,
  searchTerm: string,
  config?: Partial<OpenAIConfig>
): Promise<ExtractionResult> {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Limit content size to avoid token limits (OpenAI has context limits)
  const maxContentLength = 50000; // ~12k tokens
  const truncatedContent = content.length > maxContentLength 
    ? content.substring(0, maxContentLength) + '... [truncated]'
    : content;

  const prompt = `You are a data extraction assistant. Extract product information from a SERVITRACTOR Zoho Creator response.

The user is searching for: "${searchTerm}"

The response contains HTML and JSON data. Extract all products from the DATAJSONARRAY field within the MODEL object.

For each product, extract:
- reference (Código field): The product code/part number
- description (Nombre field): The product name/description
- price (IMPORTANT: Use "Precio antes de IVA" or "Precio sin IVA" field, NOT "Precio mas IVA" or "Precio con IVA"): Parse the price value WITHOUT IVA (format: "32.255,02" means 32255.02, where dot is thousands and comma is decimal). ALWAYS use the price WITHOUT IVA.
- stock (Stock field or zc_Stock_search): Available quantity
- hasStock: true if stock > 0, false otherwise

The response structure is:
{
  "HTML": "...",
  "MODEL": {
    "DATAJSONARRAY": [
      {
        "C_digo": "1R0750ITR",
        "Nombre": "FILTRO COMBUSTIBLE MOTOR...",
        "Stock": "6",
        "Precio antes de IVA": "$32,255.02",
        "Precio mas IVA": "$38,383.47",
        "zc_Precio_search": "32255.02",
        "zc_Stock_search": "6",
        ...
      }
    ]
  }
}

Extract ALL products from DATAJSONARRAY. Return ONLY a valid JSON object with this exact structure:
{
  "products": [
    {
      "reference": "1R0750ITR",
      "description": "FILTRO COMBUSTIBLE MOTOR...",
      "price": 32255.02,
      "stock": 6,
      "hasStock": true
    }
  ]
}

If no products are found, return: {"products": []}
If there's an error, return: {"products": [], "error": "error message"}

Response content:
${truncatedContent}`;

  try {
    // Dynamic import to avoid bundling OpenAI SDK in client-side code
    const OpenAI = (await import('openai')).default;
    
    const openai = new OpenAI({
      apiKey,
    });

    console.log('🤖 [OpenAI] Sending request to OpenAI for SERVITRACTOR extraction');
    console.log('🤖 [OpenAI] Model:', config?.model || 'gpt-4o-mini');
    console.log('🤖 [OpenAI] Search term:', searchTerm);
    console.log('🤖 [OpenAI] Content length:', truncatedContent.length);
    console.log('🤖 [OpenAI] Content preview (first 500 chars):', truncatedContent.substring(0, 500));

    const response = await openai.chat.completions.create({
      model: config?.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract structured product data from SERVITRACTOR responses. Always return valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config?.temperature ?? 0,
      max_tokens: config?.maxTokens ?? 2000,
      response_format: { type: 'json_object' } as const,
    });

    // Log OpenAI API response metadata
    console.log('🤖 [OpenAI] Response received from OpenAI API');
    console.log('🤖 [OpenAI] Response ID:', response.id);
    console.log('🤖 [OpenAI] Model used:', response.model);
    console.log('🤖 [OpenAI] Usage:', {
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
    });
    console.log('🤖 [OpenAI] Finish reason:', response.choices[0]?.finish_reason);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('❌ [OpenAI] No content in response from OpenAI');
      console.error('❌ [OpenAI] Full response:', JSON.stringify(response, null, 2));
      throw new Error('No response content from OpenAI');
    }

    // Log the raw OpenAI response content
    console.log('🤖 [OpenAI] Raw response content length:', content.length);
    console.log('🤖 [OpenAI] Raw response content:', content);

    // Parse the JSON response
    let result: ExtractionResult;
    try {
      result = JSON.parse(content) as ExtractionResult;
      console.log('🤖 [OpenAI] Successfully parsed JSON response');
      console.log('🤖 [OpenAI] Parsed result structure:', {
        hasProducts: Array.isArray(result.products),
        productCount: result.products?.length || 0,
        hasError: !!result.error,
      });
    } catch (parseError: any) {
      console.error('❌ [OpenAI] Failed to parse JSON response:', parseError.message);
      console.error('❌ [OpenAI] Raw content that failed to parse:', content);
      throw new Error(`Failed to parse OpenAI JSON response: ${parseError.message}`);
    }
    
    // Validate structure
    if (!result.products || !Array.isArray(result.products)) {
      console.error('❌ [OpenAI] Invalid response structure - missing products array');
      console.error('❌ [OpenAI] Result structure:', JSON.stringify(result, null, 2));
      throw new Error('Invalid response structure from OpenAI');
    }

    console.log(`✅ [OpenAI] Extraction successful: ${result.products.length} products extracted`);
    if (result.error) {
      console.warn('⚠️ [OpenAI] Extraction completed but with error:', result.error);
    }

    return result;
  } catch (error: any) {
    console.error('❌ [OpenAI] Error extracting SERVITRACTOR data:', error.message);
    console.error('❌ [OpenAI] Error stack:', error.stack);
    if (error.response) {
      console.error('❌ [OpenAI] OpenAI API error response:', JSON.stringify(error.response, null, 2));
    }
    throw new Error(`OpenAI extraction failed: ${error.message}`);
  }
}

/**
 * Extract product information from SERVITRACTOR when "no results" message is detected
 * This function tries to extract any product information even when the response says no results
 */
export async function extractServitractorFromNoResults(
  content: string,
  searchTerm: string,
  config?: Partial<OpenAIConfig>
): Promise<ExtractionResult> {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Limit content size to avoid token limits
  const maxContentLength = 50000; // ~12k tokens
  const truncatedContent = content.length > maxContentLength 
    ? content.substring(0, maxContentLength) + '... [truncated]'
    : content;

  const prompt = `You are a data extraction assistant. The SERVITRACTOR response says "No se encontraron resultados" (no results found), but you need to carefully analyze the response content to extract ANY product information that might be present.

The user is searching for: "${searchTerm}"

IMPORTANT: Even if the response says "no results", there might be:
1. Product data embedded in HTML/JSON
2. Alternative products with similar references
3. Data in the DATAJSONARRAY field that was not properly displayed
4. Related products or suggestions

Analyze the ENTIRE response content carefully. Look for:
- Any fields containing "C_digo", "Código", "reference", "sku"
- Any fields containing "Nombre", "name", "description"
- Any fields containing "Precio", "price", "itemPrice"
- Any fields containing "Stock", "stock", "available", "quantity"
- Any DATAJSONARRAY structure with product data
- Any HTML tables or lists with product information

Extract ALL products you can find, even if they don't exactly match the search term. Include products with similar references or partial matches.

For each product found, extract:
- reference: The product code/part number
- description: The product name/description
- price: The product price (format: "37.947,08" means 37947.08, where dot is thousands and comma is decimal)
- stock: Available quantity
- hasStock: true if stock > 0, false otherwise

Return ONLY a valid JSON object with this exact structure:
{
  "products": [
    {
      "reference": "1R0750",
      "description": "FILTRO COMBUSTIBLE MOTOR",
      "price": 37947.08,
      "stock": 6,
      "hasStock": true
    }
  ]
}

If you truly find NO products at all, return: {"products": []}
If there's an error, return: {"products": [], "error": "error message"}

Response content:
${truncatedContent}`;

  try {
    // Dynamic import to avoid bundling OpenAI SDK in client-side code
    const OpenAI = (await import('openai')).default;
    
    const openai = new OpenAI({
      apiKey,
    });

    const response = await openai.chat.completions.create({
      model: config?.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract structured product data from SERVITRACTOR responses, even when they say "no results". Carefully analyze all content to find any product information. Always return valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config?.temperature ?? 0,
      max_tokens: config?.maxTokens ?? 2000,
      response_format: { type: 'json_object' } as const,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(responseContent) as ExtractionResult;
    
    // Validate structure
    if (!result.products || !Array.isArray(result.products)) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return result;
  } catch (error: any) {
    console.error('❌ [OpenAI] Error extracting SERVITRACTOR data from no-results response:', error.message);
    throw new Error(`OpenAI extraction failed: ${error.message}`);
  }
}

/**
 * Extract product information from RETROTRAC JSON response using OpenAI
 */
export async function extractRetrotracData(
  content: string,
  searchTerm: string,
  config?: Partial<OpenAIConfig>
): Promise<ExtractionResult> {
  const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Limit content size to avoid token limits
  const maxContentLength = 50000; // ~12k tokens
  const truncatedContent = content.length > maxContentLength 
    ? content.substring(0, maxContentLength) + '... [truncated]'
    : content;

  const prompt = `You are a data extraction assistant. Extract product information from a RETROTRAC API response.

The user is searching for: "${searchTerm}"

The response contains JSON data with an items array. Extract all products from the items array.

For each product, extract:
- reference: The product code/part number (from reference field, or extract from shortDescription if reference is missing)
- description: The product name/description (from name or shortDescription field)
- price: The product price (from itemPrice field, in COP - Colombian Pesos)
- stock: Available quantity (from available field - this is the real stock, prefer over cantidad)
- hasStock: true if stock > 0, false otherwise

The response structure is:
{
  "items": [
    {
      "reference": "1R0750",
      "shortDescription": "FILTRO COMBUSTIBLE",
      "name": "FILTRO COMBUSTIBLE MOTOR",
      "itemPrice": 37947.08,
      "available": 6,
      "cantidad": 6,
      "principalImage": "...",
      ...
    }
  ],
  "cantidadTotal": 1,
  "totalPage": 1
}

Or the structure might be:
{
  "data": {
    "items": [...]
  }
}

Extract ALL products from the items array. Match products that contain the search term "${searchTerm}" in their reference or description.

Return ONLY a valid JSON object with this exact structure:
{
  "products": [
    {
      "reference": "1R0750",
      "description": "FILTRO COMBUSTIBLE MOTOR",
      "price": 37947.08,
      "stock": 6,
      "hasStock": true
    }
  ]
}

If no products are found, return: {"products": []}
If there's an error, return: {"products": [], "error": "error message"}

Response content:
${truncatedContent}`;

  try {
    // Dynamic import to avoid bundling OpenAI SDK in client-side code
    const OpenAI = (await import('openai')).default;
    
    const openai = new OpenAI({
      apiKey,
    });

    const response = await openai.chat.completions.create({
      model: config?.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract structured product data from RETROTRAC responses. Always return valid JSON only, no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: config?.temperature ?? 0,
      max_tokens: config?.maxTokens ?? 2000,
      response_format: { type: 'json_object' } as const,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response content from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(responseContent) as ExtractionResult;
    
    // Validate structure
    if (!result.products || !Array.isArray(result.products)) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Remove "RET" prefix from all references that start with "RET"
    result.products = result.products.map(product => {
      if (product.reference && product.reference.toUpperCase().startsWith('RET')) {
        product.reference = product.reference.substring(3);
      }
      return product;
    });

    return result;
  } catch (error: any) {
    console.error('❌ [OpenAI] Error extracting RETROTRAC data:', error.message);
    throw new Error(`OpenAI extraction failed: ${error.message}`);
  }
}

