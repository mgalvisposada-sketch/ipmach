# Invoice PDF (Motor) and Filipo JSON API

Motor generates invoice/remisión PDFs locally (`pdf-lib`), using the same layout as [order-pdf.ts](../src/lib/order-pdf.ts). Data comes from the Filipo Documents API as **JSON**, not the binary PDF proxy.

## Required Filipo endpoints

1. **Preferred:** `GET {DOCUMENTS_API_BASE_URL}/api/v1/documents/{externalId}?type=sale|remision&clientId=...`  
   - Headers: `Accept: application/json`, `X-API-Token: {DOCUMENTS_API_TOKEN}`  
   - Same `clientId` rules as other v1 routes (client’s identification or `CLI{id}`; admin/agent may pass `clientId` query).

2. **Fallback:** `GET .../api/documents/{externalId}` with the same query and headers (used if v1 returns 404).

3. **Sale line items (when the document JSON has no lines):** `GET {DOCUMENTS_API_BASE_URL}/api/v1/sales/{saleId}/items`  
   - Headers: `Accept: application/json`, `X-API-Token: {DOCUMENTS_API_TOKEN}`  
   - **`saleId` in the path is the sale number as text — the same value as `externalId` in Motor (e.g. `6193` for “Venta No. 6193”), not an internal document UUID.**  
   - Optional `clientId` query when Filipo requires it for multi-tenant access (same rules as other v1 routes).  
   - Response shape: `{ "data": [ ... ] }` with line fields such as `pro`, `des`, `can`, `valu`, `valt`, `pos` (sorted by `pos` in the PDF builder).

## Response shape (flexible)

The client in [filipo-document-detail.ts](../src/lib/filipo-document-detail.ts) accepts either a top-level object or `{ data: { ... } }`.

- **Lines:** `items`, `lines`, `details`, `documentLines`, or `products` (array).
- **Line fields (aliases):** reference/ref/sku/`pro`; description/name/`des`; quantity/qty/`can`; unitPrice/price/`valu`; totalPrice/total/`valt`.
- **Header:** `clientName` (or customerName, name); date as `freg`, `date`, `documentDate`, `createdAt`, `fecha`.
- **Totals (optional):** `subtotal`, `discountAmount`, `discountPercent`, `total` — when `total` is present, the PDF totals section uses these values.

If the **document** API returns **no line items** and **no `total`**, Motor (for `type=sale`) tries **`GET /api/v1/sales/{externalId}/items`** next. If that still yields nothing, the request fails with 422 unless a later fallback applies.

## Resolution order (Motor)

1. `GET /api/v1/documents/{externalId}` (then legacy `/api/documents/...` on 404).
2. For **`sale` only:** if the document has **totals but no lines**, or **no lines and no totals** (422 path), **`GET /api/v1/sales/{externalId}/items`** fills the line table.
3. If the document route **errors** (except 403): for **`sale`**, **`GET /api/v1/sales/{externalId}/items`**; if lines exist, Motor merges **metadata and totals** from **`GET /api/v1/clients/invoices`** when the matching row is found; otherwise the PDF uses sale lines only (totals summed from lines).
4. **Last resort:** **`GET /api/v1/clients/invoices`** (same as the Facturas table) with `balanceFilter=all`, find the row for `externalId` + `type`, and generate a **summary** PDF (one line with document total, paid/pending in observations) when line detail is still unavailable.

No binary PDF is ever downloaded from Filipo.

## Motor route

`GET /api/billing/invoices/[externalId]/pdf?type=sale|remision` — builds PDF with `pdf-lib` only.
