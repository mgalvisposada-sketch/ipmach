# Verify Deep Search Service Integration

## Current Status

### ✅ Individual Endpoint Route (`/api/search/deep-web/[originCode]`)
**Status**: ✅ **CALLING SERVICE**

The route at `src/app/api/search/deep-web/[originCode]/route.ts`:
- ✅ Fetches endpoint config from database
- ✅ Builds request payload
- ✅ Calls Deep Search Service at `${serviceUrl}/search` (line 116)
- ✅ Uses `DEEP_SEARCH_SERVICE_URL` and `DEEP_SEARCH_SERVICE_API_KEY` env vars
- ✅ Applies price markup after receiving results

**Frontend Usage**: The frontend (`search/page.tsx`) calls this route:
```typescript
fetch(`/api/search/deep-web/${source.originCode}`, {
    method: 'POST',
    body: JSON.stringify({ reference: term, ... })
})
```

### ⚠️ Main Route (`/api/search/deep-web`)
**Status**: ⚠️ **STILL USING OLD CODE**

The route at `src/app/api/search/deep-web/route.ts`:
- ❌ Still uses `PersistentBrowserPool` directly
- ❌ Still has old scraping logic
- ⚠️ **BUT**: Frontend doesn't use this route - it uses individual endpoints

## Verification Steps

### 1. Check Environment Variables
```bash
# In motor-parts-system/.env, ensure you have:
DEEP_SEARCH_SERVICE_URL=http://localhost:3001
DEEP_SEARCH_SERVICE_API_KEY=test-api-key-12345
```

### 2. Verify Service is Running
```bash
cd DeepSearchService
npm start
# Should see: "🚀 Deep Search Service running on port 3001"
```

### 3. Test from Next.js
When you click "Deep Web Search" button:
1. Frontend calls `/api/search/deep-web/AGROCOSTA` (for each source)
2. That route calls `http://localhost:3001/search` (Deep Search Service)
3. Service returns products
4. Next.js applies price markup and returns to frontend

### 4. Check Logs
Look for these log messages:
- `[DEEP-WEB-SINGLE]` - Next.js route processing
- `[DeepSearchService]` - Service processing
- `[PlaywrightWorker]` - Worker thread scraping

## To Fully Migrate

If you want to also update the main route (`/api/search/deep-web/route.ts`), it should:
1. Call individual endpoint routes internally, OR
2. Call the service directly for each endpoint

Currently, the main route is NOT used by the frontend, so it's optional to update it.

