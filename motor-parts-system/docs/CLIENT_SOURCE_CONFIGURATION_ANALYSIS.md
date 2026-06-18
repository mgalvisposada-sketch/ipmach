# Client Source Configuration & Custom Search Analysis

## 📋 Overview

This document analyzes the requirements for implementing per-client source configuration and a custom search interface for client role users. The feature will allow administrators to configure which external sources (DeepWebEndpoint) are available to each client and set custom profit percentages per source.

## 🎯 Requirements Summary

### 1. User Administration Form Enhancement
- **When**: User type is "client"
- **Action**: Load sources from `DeepWebEndpoint` table
- **Display**: Show list of sources with checkboxes per source
- **Storage**: Add JSON column to `Users` table to store:
  - Which sources are available for that client
  - Profit percentage per source

### 2. Access Control Changes
- **Restriction**: Clients should NOT have access to `/search` route
- **Middleware**: Add role-based access control to block clients from `/search`
- **Navigation**: Remove "Buscar" menu item for client role, add "Buscar" pointing to `/client-search`

### 3. New Client Search Page
- **Route**: `/client-search` - New menu option only for `client` role
- **Behavior**:
  - Selected client defaults to session client (cannot be changed, hidden from UI)
  - External search triggers automatically only for available sources for that client
  - Local and Costex search work the same as current `/search` (reuse backend logic)
  - External search applies the configured profit percentage for that client

## 🗄️ Database Schema Changes

### Current Schema Analysis

#### Users Model (Current)
```prisma
model Users {
  id           Int      @id @default(autoincrement())
  username     String   @unique @db.VarChar(50)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @db.VarChar(255)
  phoneNumber  String?  @db.VarChar(20)
  role         UserRole @default(agent)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  quotes       Quotes[]

  @@index([username])
  @@index([email])
  @@index([role])
}
```

#### DeepWebEndpoint Model (Current)
```prisma
model DeepWebEndpoint {
  id                Int            @id @default(autoincrement())
  originCode        String         @unique @db.VarChar(50)
  name              String         @db.VarChar(255)
  url               String         @db.Text
  method            HttpMethod     @default(GET)
  token             String?        @db.VarChar(500)
  tokenHeaderName   String?        @db.VarChar(100)
  tokenPlacement    TokenPlacement @default(header)
  requestBodyTemplate String?      @db.Text
  isActive          Boolean        @default(true)
  parserConfig      Json?
  timeoutMs         Int            @default(40000)
  retryAttempts     Int            @default(1)
  waitForSelector   String?        @db.VarChar(200)
  requiresLogin     Boolean        @default(false)
  loginUrl          String?        @db.Text
  loginUsername     String?        @db.VarChar(255)
  loginPassword     String?        @db.VarChar(255)
  loginFormSelector  String?        @db.VarChar(200)
  usernameField     String?        @db.VarChar(100)
  passwordField     String?        @db.VarChar(100)
  loginSteps        Json?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([originCode])
  @@index([isActive])
}
```

### Required Schema Changes

#### Add JSON Column to Users Model
```prisma
model Users {
  // ... existing fields ...
  sourceConfig      Json?          // Client source configuration
  // ... rest of fields ...
}
```

#### JSON Structure for `sourceConfig`
```typescript
interface ClientSourceConfig {
  sources: Array<{
    originCode: string;        // e.g., "AGROCOSTA", "PARTEQUIPOS"
    enabled: boolean;          // Whether this source is available for the client
    profitPercent: number;     // Profit percentage (e.g., 40 = 40% profit)
  }>;
}

// Example:
{
  "sources": [
    {
      "originCode": "AGROCOSTA",
      "enabled": true,
      "profitPercent": 40
    },
    {
      "originCode": "PARTEQUIPOS",
      "enabled": true,
      "profitPercent": 35
    },
    {
      "originCode": "GECOLSA",
      "enabled": false,
      "profitPercent": 0
    }
  ]
}
```

**Note**: `profitPercent` represents the profit margin. For example:
- `profitPercent: 40` means 40% profit margin
- If base price is 100, final price = 100 / (1 - 0.40) = 100 / 0.60 = 166.67
- Current hardcoded markup is `price / 0.6` which equals 66.67% markup (40% profit)

## 🎨 UI/UX Changes

### 1. User Administration Form Enhancement

#### Location
- **File**: `src/components/users/UserManagement.tsx`
- **Trigger**: When `editForm.role === 'client'` or `createForm.role === 'client'`

#### New UI Section
```typescript
// When role is 'client', show additional section:
{editForm.role === 'client' && (
  <div className="border-t border-gray-200 pt-4 mt-4">
    <h4 className="text-sm font-medium text-gray-900 mb-4">
      Configuración de Fuentes Externas
    </h4>
    <p className="text-xs text-gray-500 mb-4">
      Seleccione las fuentes disponibles para este cliente y configure el porcentaje de ganancia por fuente.
    </p>
    
    {/* List of sources with checkboxes and profit percentage inputs */}
    <div className="space-y-3">
      {availableSources.map((source) => (
        <div key={source.originCode} className="flex items-center space-x-4">
          <input
            type="checkbox"
            checked={sourceConfig.sources.find(s => s.originCode === source.originCode)?.enabled || false}
            onChange={(e) => handleSourceToggle(source.originCode, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="flex-1 text-sm text-gray-900">
            {source.name} ({source.originCode})
          </label>
          {sourceConfig.sources.find(s => s.originCode === source.originCode)?.enabled && (
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600">Ganancia %:</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={sourceConfig.sources.find(s => s.originCode === source.originCode)?.profitPercent || 0}
                onChange={(e) => handleProfitChange(source.originCode, parseFloat(e.target.value))}
                className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

#### Data Flow
1. **Load Sources**: Fetch active sources from `/api/config/endpoints` when form opens
2. **Load Client Config**: If editing, load existing `sourceConfig` from user record
3. **Initialize State**: Create `sourceConfig` state with all sources (enabled/disabled based on existing config)
4. **Save**: Include `sourceConfig` in POST/PUT request to `/api/users`

### 2. New Client Search Page

#### Route Structure
- **Path**: `/client-search` or `/search/client`
- **Access**: Only for users with `role === 'client'`
- **Layout**: Similar to `/search` but with modifications

#### Key Differences from `/search`

| Feature | `/search` (Current) | `/client-search` (New) |
|---------|---------------------|------------------------|
| Client Selection | Optional, can be changed | Fixed to session user, hidden |
| External Search | Manual trigger (button) | Automatic on search |
| Sources | All active sources | Only client's enabled sources |
| Price Markup | Fixed `price / 0.6` | Per-source profit percentage |
| Deep Web Search | User clicks "Externos" | Auto-triggers with search |

#### Component Structure
```typescript
// src/app/(dashboard)/client-search/page.tsx
export default function ClientSearchPage() {
  const { data: session } = useSession();
  const clientId = parseInt(session?.user?.id || '0');
  
  // Load client's source configuration
  const [clientSourceConfig, setClientSourceConfig] = useState<ClientSourceConfig | null>(null);
  
  // Similar state to /search but:
  // - clientId is fixed (session user)
  // - handleSearch automatically triggers deep web search
  // - Only searches enabled sources
  
  const handleSearch = async (term: string) => {
    // 1. Perform local search (same as /search)
    // 2. Automatically trigger deep web search for enabled sources
    // 3. Apply per-source profit percentages
  };
  
  // ... rest of component
}
```

## 🔄 Reusable Logic Analysis

### Backend Logic Reuse

#### 1. Local Search API (`/api/search/route.ts`)
**Status**: ✅ **Fully Reusable**
- Handles internal product search via `stockServiceAPI`
- Handles Costex external search
- Applies client type pricing
- No changes needed - can be called directly from client search

**Reuse Strategy**:
```typescript
// Client search page can call the same endpoint
const response = await fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    reference: term, 
    clientId: sessionClientId,  // Fixed to session user
    clientType: sessionClientType,
    likeSearch 
  }),
});
```

#### 2. Deep Web Search API (`/api/search/deep-web/[originCode]/route.ts`)
**Status**: ⚠️ **Needs Modification**
- Currently applies hardcoded `price / 0.6` markup
- Needs to accept and apply per-client, per-source profit percentage
- Core scraping logic is reusable

**Modification Required**:
- Add client source config lookup
- Replace hardcoded markup with dynamic profit calculation
- Filter sources based on client configuration (handled in frontend)

#### 3. Costex Search API (`/api/search/costex`)
**Status**: ✅ **Fully Reusable**
- Already called from `/api/search/route.ts`
- No changes needed

### Frontend Logic Reuse

#### 1. SearchForm Component (`src/components/forms/SearchForm.tsx`)
**Status**: ⚠️ **Needs Variant**
- Current component allows client selection (for agents/admins)
- Client search needs a simplified version without client selector

**Reuse Strategy**:
- Create `ClientSearchForm` component that:
  - Extends or wraps `SearchForm`
  - Hides client selection field
  - Auto-sets client to session user
  - Automatically triggers deep web search on submit

#### 2. Search Results Components
**Status**: ✅ **Fully Reusable**
- `UnifiedSearchResults` - Can be reused as-is
- `SearchResults` - Can be reused as-is
- `QuoteBuilder` - Can be reused as-is
- All result display logic is role-agnostic

#### 3. Search State Management
**Status**: ✅ **Fully Reusable**
- State variables (searchResults, externalResults, deepWebResults, etc.)
- Sorting functions (`sortResultsByStockAvailability`)
- Item selection and quote management
- All can be reused with minimal changes

#### 4. Deep Web Search Logic
**Status**: ⚠️ **Needs Modification**
- Current `handleDeepWebSearch` fetches all active sources
- Client search needs to filter to only enabled sources
- Price calculation needs per-source profit percentage

**Modification Required**:
```typescript
// Current: Fetches all active sources
const sourcesResponse = await fetch('/api/config/endpoints');
const activeSources = sourcesData.endpoints.filter(e => e.isActive);

// Client Search: Filter to enabled sources
const sourcesResponse = await fetch('/api/config/endpoints');
const clientConfig = await fetch(`/api/users/${clientId}/source-config`);
const enabledSources = clientConfig.sourceConfig.sources
  .filter(s => s.enabled)
  .map(s => s.originCode);
const activeSources = sourcesData.endpoints.filter(
  e => e.isActive && enabledSources.includes(e.originCode)
);
```

### Shared Utilities

#### 1. Price Calculation
**Location**: Create shared utility function
```typescript
// src/lib/utils/price-calculation.ts
export function calculatePriceWithProfit(
  basePrice: number, 
  profitPercent: number
): number {
  if (profitPercent <= 0) return basePrice;
  const multiplier = 1 / (1 - profitPercent / 100);
  return Math.round(basePrice * multiplier);
}
```

#### 2. Source Configuration Helpers
**Location**: Create shared utility functions
```typescript
// src/lib/utils/source-config.ts
export function getEnabledSources(
  sourceConfig: ClientSourceConfig
): string[] {
  return sourceConfig.sources
    .filter(s => s.enabled)
    .map(s => s.originCode);
}

export function getProfitPercentForSource(
  sourceConfig: ClientSourceConfig,
  originCode: string
): number {
  const source = sourceConfig.sources.find(
    s => s.originCode === originCode && s.enabled
  );
  return source?.profitPercent || 40; // Default 40%
}
```

## 🔧 Implementation Details

### 1. Access Control Implementation

#### Middleware Update (`middleware.ts`)
```typescript
// Role-based access control
if (pathname.startsWith('/users') && token.role !== 'admin') {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}

// NEW: Block clients from /search
if (pathname.startsWith('/search') && token.role === 'client') {
  return NextResponse.redirect(new URL('/client-search', req.url));
}

// NEW: Block non-clients from /client-search
if (pathname.startsWith('/client-search') && token.role !== 'client') {
  return NextResponse.redirect(new URL('/dashboard', req.url));
}
```

#### Navigation Update (`src/app/(dashboard)/layout.tsx`)
```typescript
const navigation = [
  { name: 'Panel', href: '/dashboard', icon: HomeIcon, roles: ['admin', 'agent', 'client'] },
  // OLD: { name: 'Buscar', href: '/search', icon: MagnifyingGlassIcon, roles: ['admin', 'agent', 'client'] },
  { name: 'Buscar', href: '/search', icon: MagnifyingGlassIcon, roles: ['admin', 'agent'] }, // Remove 'client'
  { name: 'Buscar', href: '/client-search', icon: MagnifyingGlassIcon, roles: ['client'] }, // New for clients
  { name: 'Cotizaciones', href: '/quotes', icon: ClipboardDocumentListIcon, roles: ['admin', 'agent'] },
  { name: 'Usuarios', href: '/users', icon: UsersIcon, roles: ['admin'] },
];
```

### 2. API Changes

#### User API (`/api/users/[id]/route.ts`)
**GET**: Include `sourceConfig` in response
```typescript
const user = await prisma.users.findUnique({
  where: { id: parseInt(id) },
  select: {
    // ... existing fields ...
    sourceConfig: true,
  },
});
```

**PUT**: Handle `sourceConfig` in update
```typescript
const { sourceConfig, ...otherFields } = await request.json();

await prisma.users.update({
  where: { id: parseInt(id) },
  data: {
    ...otherFields,
    sourceConfig: sourceConfig ? JSON.parse(JSON.stringify(sourceConfig)) : null,
  },
});
```

#### New API Endpoint: Get Client Source Config
**Route**: `/api/users/[id]/source-config`
**Method**: GET
**Purpose**: Fetch client's source configuration
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await prisma.users.findUnique({
    where: { id: parseInt(params.id) },
    select: { sourceConfig: true, role: true },
  });
  
  if (!user || user.role !== 'client') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    sourceConfig: user.sourceConfig || { sources: [] },
  });
}
```

### 2. Deep Web Search Modifications

#### Current Price Markup (Hardcoded)
**Location**: `src/app/api/search/deep-web/[originCode]/route.ts`
**Line**: 247
```typescript
product.price = Math.round(product.price / 0.6);
```

#### New Price Calculation (Per-Client, Per-Source)
```typescript
// Calculate price based on client's profit percentage
function calculatePriceWithProfit(basePrice: number, profitPercent: number): number {
  if (profitPercent <= 0) return basePrice;
  // profitPercent is the profit margin (e.g., 40 = 40%)
  // If base price is 100 and profit is 40%, final = 100 / (1 - 0.40) = 166.67
  const multiplier = 1 / (1 - profitPercent / 100);
  return Math.round(basePrice * multiplier);
}

// In route handler:
const { reference, clientId, clientType } = await request.json();

// Fetch client's source config
let profitPercent = 40; // Default (current behavior: 40% profit = /0.6)
if (clientId) {
  const client = await prisma.users.findUnique({
    where: { id: clientId },
    select: { sourceConfig: true },
  });
  
  if (client?.sourceConfig) {
    const config = client.sourceConfig as ClientSourceConfig;
    const sourceConfig = config.sources.find(
      s => s.originCode === originCode && s.enabled
    );
    if (sourceConfig) {
      profitPercent = sourceConfig.profitPercent;
    }
  }
}

// Apply profit percentage
const products = data.products.map((product: Product) => {
  if (product.price && product.price > 0) {
    product.price = calculatePriceWithProfit(product.price, profitPercent);
  }
  return product;
});
```

### 3. Client Search Page Implementation

#### Component Structure (Reusing /search Logic)
```typescript
// src/app/(dashboard)/client-search/page.tsx
// Reuses most logic from /search/page.tsx with modifications:

export default function ClientSearchPage() {
  const { data: session } = useSession();
  const clientId = parseInt(session?.user?.id || '0');
  const clientType = 2; // Default or from user profile
  
  // Load client's source configuration ONCE on mount
  const [clientSourceConfig, setClientSourceConfig] = useState<ClientSourceConfig | null>(null);
  
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/users/${clientId}/source-config`);
        const data = await response.json();
        setClientSourceConfig(data.sourceConfig || { sources: [] });
      } catch (error) {
        console.error('Failed to load source config:', error);
        // Use default: all sources, 40% profit
        setClientSourceConfig({ sources: [] });
      }
    };
    if (clientId) loadConfig();
  }, [clientId]);
  
  // REUSE: Same state management as /search
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [externalResults, setExternalResults] = useState<ExternalResult[]>([]);
  const [deepWebResults, setDeepWebResults] = useState<SearchResult[]>([]);
  // ... same as /search
  
  // REUSE: Same local search handler (calls same API)
  const handleSearch = async (term: string, likeSearch?: boolean) => {
    // Same implementation as /search, but:
    // - clientId is fixed (session user)
    // - Automatically triggers deep web search after local search
    setIsSearching(true);
    setSearchTerm(term);
    
    try {
      // REUSE: Same API call
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reference: term, 
          clientId,  // Fixed to session user
          clientType,
          likeSearch 
        }),
      });
      
      // REUSE: Same result processing
      const data = await response.json();
      const results: SearchResult[] = (data.data || []).map((r: any) => ({
        ...r,
        basePriceCOP: r.basePriceCOP || 0,
      }));
      const external: ExternalResult[] = (data.externalResults || []).map((ext: any) => ({
        source: ext.source || 'external',
        data: ext
      }));
      
      const sortedResults = sortResultsByStockAvailability(results, external);
      setSearchResults(sortedResults.internal);
      setExternalResults(sortedResults.external);
      
      // NEW: Automatically trigger deep web search
      if (clientSourceConfig) {
        await handleDeepWebSearch(term);
      }
    } catch (error: any) {
      // ... error handling
    } finally {
      setIsSearching(false);
    }
  };
  
  // MODIFIED: Deep web search with source filtering and profit calculation
  const handleDeepWebSearch = async (term: string) => {
    if (!term.trim() || !clientSourceConfig) return;
    
    setIsDeepWebSearching(true);
    
    // Get enabled sources from client config
    const enabledSources = getEnabledSources(clientSourceConfig);
    
    if (enabledSources.length === 0) {
      setIsDeepWebSearching(false);
      return; // No enabled sources
    }
    
    // Fetch all active sources
    const sourcesResponse = await fetch('/api/config/endpoints');
    const sourcesData = await sourcesResponse.json();
    
    // Filter to only enabled sources
    const activeSourcesList = sourcesData.endpoints
      .filter((e: any) => e.isActive && enabledSources.includes(e.originCode))
      .map((e: any) => ({
        originCode: e.originCode,
        originName: e.name,
      }));
    
    // REUSE: Same parallel search logic as /search
    const allPromises = activeSourcesList.map(async (source) => {
      try {
        const response = await fetch(`/api/search/deep-web/${source.originCode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: term,
            clientId,  // Pass clientId for profit calculation
            clientType
          }),
        });
        
        const data = await response.json();
        
        if (data.success && data.products) {
          // Apply client's profit percentage for this source
          const profitPercent = getProfitPercentForSource(
            clientSourceConfig,
            source.originCode
          );
          
          const originResults: SearchResult[] = data.products.map((product: any) => ({
            reference: product.reference,
            stockQty: product.stock || 0,
            basePriceCOP: calculatePriceWithProfit(product.price || 0, profitPercent),
            hasStock: product.hasStock || false,
            location: product.location,
            description: product.description,
            origin: product.origin || source.originCode,
          }));
          
          // REUSE: Same state update logic
          setDeepWebResultsByOrigin((prev) => {
            const updated = new Map(prev);
            updated.set(source.originCode, originResults);
            return updated;
          });
          
          return { originCode: source.originCode, success: true, count: originResults.length };
        }
        // ... error handling
      } catch (error: any) {
        // ... error handling
      }
    });
    
    // REUSE: Same Promise.allSettled logic
    await Promise.allSettled(allPromises);
    setIsDeepWebSearching(false);
  };
  
  // REUSE: All other handlers (handleItemToggle, handleAddToQuote, etc.)
  // ... same as /search
  
  return (
    <div className="space-y-6">
      {/* REUSE: Same header structure */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buscar Repuestos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Busque repuestos y cree cotizaciones con los ítems seleccionados.
        </p>
      </div>
      
      {/* MODIFIED: Use ClientSearchForm instead of SearchForm */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Buscar Piezas</h2>
        </div>
        <div className="card-body">
          <ClientSearchForm
            onSearch={handleSearch}
            isLoading={isSearching}
            isDeepWebSearching={isDeepWebSearching}
          />
        </div>
      </div>
      
      {/* REUSE: Same results display */}
      {/* ... same as /search */}
    </div>
  );
}
```

#### ClientSearchForm Component (Simplified SearchForm)
```typescript
// src/components/forms/ClientSearchForm.tsx
// Simplified version of SearchForm without client selection

export function ClientSearchForm({ onSearch, isLoading, isDeepWebSearching }: ClientSearchFormProps) {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  
  // REUSE: Same suggestion logic
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // ... same as SearchForm
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Automatically trigger search (which will trigger deep web search)
      onSearch(searchTerm.trim(), true); // likeSearch = true
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* REUSE: Same search input and suggestions */}
      <div className="relative">
        <label htmlFor="searchTerm" className="block text-sm font-medium text-gray-700">
          Referencia de Pieza
        </label>
        {/* ... same input as SearchForm */}
      </div>
      
      {/* REMOVED: Client selection field */}
      
      {/* REUSE: Same action buttons */}
      <div className="flex items-center justify-between">
        <button
          type="submit"
          disabled={isLoading || isDeepWebSearching || !searchTerm.trim()}
          className="btn-primary"
        >
          {isLoading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
    </form>
  );
}
```

## 📊 Data Flow Diagrams

### User Administration Flow
```
Admin opens User Management
  ↓
Admin selects/creates client user
  ↓
Form shows "Source Configuration" section
  ↓
System fetches active sources from DeepWebEndpoint
  ↓
System loads existing sourceConfig (if editing)
  ↓
Admin checks/unchecks sources and sets profit percentages
  ↓
Admin saves user
  ↓
sourceConfig saved to Users.sourceConfig JSON column
```

### Client Search Flow
```
Client navigates to /client-search
  ↓
System loads client's sourceConfig
  ↓
Client enters reference and searches
  ↓
System performs local search (same as /search)
  ↓
System automatically triggers deep web search
  ↓
System filters to only enabled sources for client
  ↓
For each enabled source:
  ├─ Fetch results
  ├─ Apply client's profit percentage for that source
  └─ Display results
  ↓
Results displayed with per-source pricing
```

## 🔐 Security Considerations

1. **Client Access Control**
   - Only users with `role === 'client'` can access `/client-search`
   - Client cannot change their own source configuration
   - Client cannot access other clients' configurations

2. **Admin Access Control**
   - Only admins can modify user source configurations
   - Validate source configuration structure before saving
   - Ensure profit percentages are within reasonable bounds (0-100%)

3. **Data Validation**
   - Validate `sourceConfig` JSON structure
   - Ensure `originCode` references exist in `DeepWebEndpoint`
   - Validate `profitPercent` is a number between 0 and 100

## 📝 Migration Strategy

### Step 1: Database Migration
```sql
-- Add sourceConfig column to Users table
ALTER TABLE "Users" ADD COLUMN "sourceConfig" JSONB;

-- Create index for JSON queries (optional, for performance)
CREATE INDEX "Users_sourceConfig_idx" ON "Users" USING GIN ("sourceConfig");
```

### Step 2: Prisma Schema Update
```prisma
model Users {
  // ... existing fields ...
  sourceConfig      Json?          // Client source configuration
  // ... rest of fields ...
}
```

### Step 3: Backward Compatibility
- Existing clients without `sourceConfig` should use default behavior (all sources, 40% profit)
- Migration script to set default config for existing clients (optional)

## 🧪 Testing Scenarios

### 1. User Administration
- [ ] Create new client user with source configuration
- [ ] Edit existing client user's source configuration
- [ ] Verify sources are loaded from DeepWebEndpoint
- [ ] Verify profit percentages are saved correctly
- [ ] Verify non-client users don't show source configuration section

### 2. Client Search
- [ ] Client can access `/client-search`
- [ ] Client cannot change client selection (hidden/fixed)
- [ ] Search automatically triggers deep web search
- [ ] Only enabled sources are searched
- [ ] Prices are calculated with correct profit percentages
- [ ] Local and Costex searches work normally

### 3. Edge Cases
- [ ] Client with no source configuration (should use defaults)
- [ ] Client with all sources disabled (should only show local results)
- [ ] Client with invalid source configuration (should handle gracefully)
- [ ] Source becomes inactive after client configuration (should skip it)

## 📈 Performance Considerations

1. **Source Configuration Caching**
   - Cache client's source configuration in session or context
   - Avoid fetching on every search request

2. **Parallel Search Optimization**
   - Current implementation already uses parallel searches
   - Filtering to enabled sources reduces unnecessary API calls

3. **Database Queries**
   - Consider adding index on `sourceConfig` for JSON queries
   - Batch fetch source configurations if needed

## 🚀 Implementation Phases

### Phase 1: Database & Schema
- [ ] Add `sourceConfig` column to Users table
- [ ] Update Prisma schema
- [ ] Create migration script

### Phase 2: User Administration
- [ ] Update UserManagement component
- [ ] Add source configuration UI
- [ ] Update user API endpoints
- [ ] Add validation

### Phase 3: Client Search Page
- [ ] Create new `/client-search` route
- [ ] Implement automatic deep web search
- [ ] Implement source filtering
- [ ] Implement per-source profit calculation

### Phase 4: Testing & Refinement
- [ ] Test all scenarios
- [ ] Performance optimization
- [ ] Error handling
- [ ] Documentation

## 📚 Related Files

### Files to Modify
- `prisma/schema.prisma` - Add `sourceConfig` field
- `middleware.ts` - Add access control for `/search` and `/client-search`
- `src/app/(dashboard)/layout.tsx` - Update navigation menu (separate search links for roles)
- `src/components/users/UserManagement.tsx` - Add source configuration UI
- `src/app/api/users/[id]/route.ts` - Handle `sourceConfig` in CRUD
- `src/app/api/search/deep-web/[originCode]/route.ts` - Apply per-client profit percentage

### Files to Create
- `src/app/(dashboard)/client-search/page.tsx` - New client search page (reuses /search logic)
- `src/components/forms/ClientSearchForm.tsx` - Simplified search form without client selector
- `src/app/api/users/[id]/source-config/route.ts` - Get client source config API
- `src/lib/utils/price-calculation.ts` - Shared price calculation utility
- `src/lib/utils/source-config.ts` - Shared source configuration helpers
- `prisma/migrations/XXXXXX_add_source_config_to_users/migration.sql` - Migration

### Type Definitions
- `src/types/index.ts` - Add `ClientSourceConfig` interface

## 🔄 Current vs. Proposed Behavior

### Current Behavior
- **Access**: All roles (admin, agent, client) can access `/search`
- **Sources**: All clients see all active sources
- **Profit**: Fixed profit percentage (40% = price / 0.6)
- **External Search**: Manual trigger (user clicks "Externos" button)
- **Client Selection**: Optional, can be changed by agents/admins

### Proposed Behavior
- **Access**: 
  - `/search` - Only admin and agent roles
  - `/client-search` - Only client role
  - Clients redirected from `/search` to `/client-search`
- **Sources**: Clients see only enabled sources (configured per client)
- **Profit**: Custom profit percentage per source per client
- **External Search**: Automatic trigger on search (no manual button)
- **Client Selection**: Fixed to session user, hidden from UI

## 💡 Additional Considerations

1. **Default Configuration**
   - What happens if a client has no `sourceConfig`?
   - **Decision**: Use default behavior (all active sources, 40% profit)
   - Implementation: Check for null/empty config and fallback to defaults

2. **Source Management**
   - What happens if a source is deactivated after client configuration?
   - **Decision**: Filter out inactive sources in frontend (already handled by `isActive` check)
   - Should we validate source codes exist when saving configuration?
   - **Decision**: Yes, validate against `DeepWebEndpoint` table before saving

3. **Profit Percentage Validation**
   - Minimum: 0% (no profit, pass-through)
   - Maximum: 100% (double the price)
   - Recommended range: 20-60%
   - **Implementation**: Add validation in UserManagement form and API

4. **Code Reuse Strategy**
   - **Backend**: Reuse `/api/search` endpoint as-is (no changes needed)
   - **Backend**: Modify `/api/search/deep-web/[originCode]` to accept profit percentage
   - **Frontend**: Extract shared utilities (price calculation, source config helpers)
   - **Frontend**: Create `ClientSearchForm` as simplified variant of `SearchForm`
   - **Frontend**: Reuse all result display components and state management

5. **UI/UX Enhancements**
   - Show profit percentage impact preview in user management form
   - Bulk enable/disable sources
   - Copy configuration from another client
   - Show which sources are enabled in client search page header

6. **Audit Trail**
   - Log when source configurations are changed
   - Track who modified configurations and when
   - Consider adding `updatedBy` and `updatedAt` to source config JSON

7. **Performance Optimization**
   - Cache client source config in session/context to avoid repeated API calls
   - Batch source configuration loading if multiple clients need to be configured
   - Consider adding index on `sourceConfig` JSON column for faster queries

