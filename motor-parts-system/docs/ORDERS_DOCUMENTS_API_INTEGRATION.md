# Orders – Documents API Integration

When an order is created in the Motor Parts System, it is pushed to the **Documents API** (external software) so the order exists in both systems. Each order line is sent with:

- **`price`**: Unit selling price (with profit applied).
- **`cost`**: Unit cost of the product (before profit). Used by the other software for margin and accounting.

Product creation in the Documents API still uses the selling `price`; cost is sent only at the order line level.

## Environment variables

Configure in `.env`:

- `DOCUMENTS_API_BASE_URL` – Base URL of the Documents API (e.g. `http://localhost:3000`).
- `DOCUMENTS_API_TOKEN` – API token for `X-API-Token` header.

## Creating an order in Motor Parts System (A)

Orders are created via `POST /api/orders` with a valid session (NextAuth). The backend then pushes the order to the Documents API with `price` and `cost` per line.

Example request body (items should include `basePriceCOP` or `unitCost` for cost to be sent):

```json
{
  "clientId": 1,
  "clientName": "Cliente Ejemplo",
  "totalAmount": 250.00,
  "items": [
    {
      "reference": "REF-001",
      "quantity": 2,
      "unitPrice": 99.50,
      "totalPrice": 199.00,
      "basePriceCOP": 60.00
    },
    {
      "reference": "REF-002",
      "quantity": 1,
      "unitPrice": 150.00,
      "totalPrice": 150.00,
      "basePriceCOP": 90.00
    }
  ],
  "observations": "Optional notes",
  "orderName": "PO-2024-001",
  "dispatchType": "pickup",
  "pickupEntity": "Empresa",
  "pickupName": "Juan Pérez",
  "paymentMethod": "transfer"
}
```

**Curl (with session cookie):**

After logging in via the app, use the session cookie from the browser, or use another auth mechanism your app supports:

```bash
# Replace COOKIE with your NextAuth session cookie (e.g. from browser dev tools)
# Replace BASE_URL with your app URL (e.g. http://localhost:3001)

BASE_URL="http://localhost:3001"
COOKIE="next-auth.session-token=YOUR_SESSION_TOKEN"

curl -X POST "${BASE_URL}/api/orders" \
  -H "Content-Type: application/json" \
  -H "Cookie: ${COOKIE}" \
  -d '{
    "clientId": 1,
    "clientName": "Cliente Ejemplo",
    "totalAmount": 250.00,
    "items": [
      {
        "reference": "REF-001",
        "quantity": 2,
        "unitPrice": 99.50,
        "totalPrice": 199.00,
        "basePriceCOP": 60.00
      },
      {
        "reference": "REF-002",
        "quantity": 1,
        "unitPrice": 150.00,
        "totalPrice": 150.00,
        "basePriceCOP": 90.00
      }
    ],
    "observations": "Pedido desde API",
    "orderName": "PO-2024-001",
    "dispatchType": "pickup",
    "pickupEntity": "Empresa",
    "pickupName": "Juan Pérez",
    "paymentMethod": "transfer"
  }'
```

The response includes the created order; the push to the Documents API runs in the background with the same `price` and `cost` per line.

---

## Creating an order directly in the Documents API (B)

To create the order **only** in the other software (Documents API), call its orders endpoint with the same payload shape. Each line must include `price` (selling price with profit) and `cost` (unit cost).

**Curl:**

```bash
# Set from your .env or replace with real values
DOCUMENTS_API_BASE_URL="http://localhost:3000"
DOCUMENTS_API_TOKEN="t5gtwq3mbIJVscOiMwQQtpcRhVxXYBMz"

curl -X POST "${DOCUMENTS_API_BASE_URL}/api/v1/orders" \
  -H "X-API-Token: ${DOCUMENTS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "terceroId": "CLI1",
      "name": "Cliente Ejemplo",
      "phone": "+57 300 123 4567"
    },
    "items": [
      { "productId": 1, "quantity": 2, "price": 99.50, "cost": 60.00 },
      { "productId": 2, "quantity": 1, "price": 150.00, "cost": 90.00 }
    ],
    "notes": "Pedido desde API",
    "status": "created"
  }'
```

**Payload summary:**

| Field | Description |
|-------|-------------|
| `customer.terceroId` | Client identifier in the other system (e.g. `CLI{id}` or tax ID). |
| `customer.name` | Client name. |
| `customer.phone` | Client phone (optional). |
| `items[].productId` | Product ID in the Documents API (from `GET /api/v1/products?reference=...` or product creation). |
| `items[].quantity` | Quantity ordered. |
| `items[].price` | **Unit selling price** (with profit). |
| `items[].cost` | **Unit cost** of the product. |
| `notes` | Order notes. |
| `status` | e.g. `"created"`. |

If the Documents API uses different field names (e.g. `unitCost` instead of `cost`), the backend in this project would need to be aligned to match that contract.

---

## Credit limit and external debt (billing)

The admin assigns a **credit limit** and **payment term in days** (`creditPaymentTermDays`: 30, 45, 60, 90, or 120) to clients with `hasCredit` and `creditLimit`. The term is measured from each external document’s date (`freg`) to its due date for **portfolio control**.

**Portfolio control**: If any unpaid document (pending balance > 0) is more than **10 calendar days** past its due date (document date + `creditPaymentTermDays`), `POST /api/orders` returns **400** for that client until the situation is resolved (fail-open if the Documents API is unavailable). The `/credit` page and order UIs surface this state.

Order creation is also restricted by comparing the credit limit to:

1. **General debt (deuda general)** – Pending amount from the Documents API for the client (`GET /api/v1/clients/pending?clientId=...`). The Motor Parts System fetches this server-side via `src/lib/external-billing.ts` when computing available credit.
2. **Pending/processing orders** – Sum of order totals in this system with status `pending` or `processing`.

**Available credit** = `creditLimit - externalDebt - pendingOrdersSum`.

- **Order creation**: For any client with credit, `POST /api/orders` rejects with **400** if portfolio is blocked (severe overdue) or if the order total would exceed available credit (for any payment method).
- **UI**: Clients have a **Crédito** menu entry (`/credit`) with cupo total, deuda general (with document detail modal), órdenes abiertas that consume quota, and messaging when they have no credit line. OrderBuilder and quote-to-order modals show a short **cupo disponible** line with a link to that page. Creating an order is blocked when the total exceeds available credit, with a clear message.

So the client cannot generate a new purchase order until their account or general debt is below the assigned credit limit.
