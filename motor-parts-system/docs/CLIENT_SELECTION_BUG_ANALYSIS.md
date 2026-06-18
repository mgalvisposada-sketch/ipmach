# Client Selection Bug Analysis

## Problem Description

When searching for a reference in `/search`, the selected client is being changed or cleared unexpectedly.

## Root Cause

The issue occurs due to a synchronization problem between the `SearchForm` component's client selection state and the `QuoteContext`'s quote state.

### Flow of the Bug

1. **User selects a client** in `SearchForm.tsx`:
   - `selectedClientId` and `selectedClientType` are set
   - `updateQuoteClient()` is called to sync with the quote

2. **User searches for a reference**:
   - Search is performed with the selected client
   - Results are displayed

3. **User adds an item to the quote**:
   - `addItemToQuote()` is called in `QuoteContext.tsx`
   - This updates `currentQuote` state
   - If no quote exists, a new quote is created **without client information**

4. **The `useEffect` in `SearchForm.tsx` runs**:
   ```typescript
   useEffect(() => {
       if (currentQuote?.clientId && currentQuote?.clientName) {
           setSelectedClientId(currentQuote.clientId);
           setSelectedClientType(currentQuote.clientType);
           setClientQuery(currentQuote.clientName);
       }
   }, [currentQuote]);
   ```

5. **The problem**: 
   - If the quote doesn't have a client (newly created quote), the `useEffect` doesn't run the `if` block
   - However, if the quote was previously cleared or doesn't have client info, the form's client selection might be out of sync
   - More critically: When `addItemToQuote` creates a new quote, it doesn't preserve the client that was selected in the form

### Code Locations

**File: `src/components/forms/SearchForm.tsx`**
- Lines 56-62: `useEffect` that syncs client from quote to form
- Problem: This only syncs FROM quote TO form, but doesn't handle the case where form has a client but quote doesn't

**File: `src/contexts/QuoteContext.tsx`**
- Lines 145-203: `addItemToQuote` function
- Problem: When creating a new quote (line 167-176), it doesn't include client information
- Problem: When updating an existing quote (line 180-186), it doesn't preserve client information if it exists

## Solution

1. **Fix `addItemToQuote` to preserve client information**:
   - When creating a new quote, check if there's a selected client in the form/context
   - When updating an existing quote, preserve the existing client information

2. **Improve the `useEffect` in `SearchForm.tsx`**:
   - Only sync FROM quote TO form if the form doesn't already have a client selected
   - Or, ensure the quote always has the client when items are added

3. **Alternative approach**: 
   - Pass the client information to `addItemToQuote` so it can be preserved in the quote
   - This ensures the quote always has the client that was selected when items were added

## Recommended Fix

The best approach is to ensure that when `addItemToQuote` is called, it preserves the client information from the quote context. If the quote doesn't have a client but the form has one selected, we should update the quote with the form's client selection.

However, a better approach is to ensure that `addItemToQuote` receives the client information as a parameter, or we ensure the quote's client is always in sync with the form's selection before adding items.

## Implementation

### Fix 1: Preserve Client Info in `addItemToQuote`

**File: `src/contexts/QuoteContext.tsx`**

When creating a new quote, check localStorage for existing client information:
```typescript
if (!prevQuote) {
    // Check localStorage for existing quote with client info
    let preservedClientInfo = {};
    try {
        const savedQuote = localStorage.getItem(QUOTE_STORAGE_KEY);
        if (savedQuote) {
            const parsed = JSON.parse(savedQuote);
            if (parsed.clientId && parsed.clientName) {
                preservedClientInfo = {
                    clientId: parsed.clientId,
                    clientName: parsed.clientName,
                    clientType: parsed.clientType,
                };
            }
        }
    } catch (e) {
        // Ignore localStorage errors
    }
    // Include preservedClientInfo in newQuote
}
```

When updating an existing quote, explicitly preserve client information:
```typescript
const updatedQuote = {
    ...prevQuote,
    items: updatedItems,
    totalAmount: ...,
    updatedAt: new Date(),
    // Preserve client information if it exists
    clientId: prevQuote.clientId,
    clientName: prevQuote.clientName,
    clientType: prevQuote.clientType,
};
```

### Fix 2: Improve Bidirectional Sync in `SearchForm`

**File: `src/components/forms/SearchForm.tsx`**

Update the `useEffect` to:
1. Only sync FROM quote TO form if the form doesn't have a client or if they're different
2. Sync FROM form TO quote if the form has a client but the quote doesn't (only when quote exists)

```typescript
useEffect(() => {
    if (currentQuote?.clientId && currentQuote?.clientName) {
        // Only update form if it doesn't have a client selected, or if the quote's client is different
        if (!selectedClientId || selectedClientId !== currentQuote.clientId) {
            setSelectedClientId(currentQuote.clientId);
            setSelectedClientType(currentQuote.clientType);
            setClientQuery(currentQuote.clientName);
        }
    } else if (selectedClientId && currentQuote && !currentQuote.clientId) {
        // If form has a client but quote doesn't, sync FROM form TO quote
        const clientName = clientQuery || `Client ${selectedClientId}`;
        updateQuoteClient(selectedClientId, clientName, selectedClientType);
    }
}, [currentQuote, selectedClientId, selectedClientType, clientQuery, updateQuoteClient]);
```

## Testing

To verify the fix works:
1. Select a client in the search form
2. Search for a reference
3. Add an item to the quote
4. Verify the client selection remains unchanged
5. Search for another reference
6. Verify the client selection is still preserved

