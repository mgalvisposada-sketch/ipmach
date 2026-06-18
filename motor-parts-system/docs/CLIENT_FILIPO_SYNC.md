# Client Sync with Filipo (Documents API)

When a client is created in Motor Parts System, their profile is automatically pushed to the Filipo-Web Documents API so the client exists in both systems.

## How It Works

1. A client is created via `POST /api/users` (admin) or `POST /api/auth/register` (self-registration).
2. After local creation succeeds, the system calls `POST /api/v1/customers` on the Documents API (Filipo-Web).
3. The endpoint is **idempotent**: if a client with the same `externalId` (identification) already exists for the admin, contact fields are updated instead.

## Field Mapping

| Motor Parts (Users)               | Filipo (clients)  | Notes                          |
|------------------------------------|-------------------|--------------------------------|
| `identification`                   | `externalId`      | Required. Lookup key.          |
| `clientName ?? username ?? email`  | `name`            | Fallback chain for display.    |
| `email`                            | `email`           | Lowercased.                    |
| `phoneCountryCode + phoneNumber`   | `phone`           | Joined with space.             |
| `address`                          | `address`         |                                |
| `city`                             | `city`            |                                |
| `stateOrDepartment`                | `department`      |                                |
| `country`                          | `country`         |                                |

Filipo defaults applied on creation: `partyType = 'client'`, `isActive = true`, `payMethod = 'CONTADO'`, `priceList = 1`.

## Environment Variables

Uses the same env vars as order/billing integration:

```env
DOCUMENTS_API_BASE_URL="http://localhost:3000"
DOCUMENTS_API_TOKEN="your-api-token"
```

## Fail-Open Policy

- If the Documents API is unreachable or returns an error, the local user creation still succeeds (HTTP 201).
- A warning is logged: `[filipo-client-sync] ...` or `[POST /api/users] Filipo sync failed ...`.
- The sync can be retried manually or via a future cron job.

## Curl Example

To create/update a client directly in Filipo:

```bash
DOCUMENTS_API_BASE_URL="http://localhost:3000"
DOCUMENTS_API_TOKEN="t5gtwq3mbIJVscOiMwQQtpcRhVxXYBMz"

curl -X POST "${DOCUMENTS_API_BASE_URL}/api/v1/customers" \
  -H "X-API-Token: ${DOCUMENTS_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "NIT123456",
    "name": "Acme Corp",
    "email": "acme@example.com",
    "phone": "+57 300 123 4567",
    "address": "Calle 123",
    "city": "Bogota",
    "department": "Cundinamarca",
    "country": "Colombia"
  }'
```

**Response (created):**

```json
{
  "error": null,
  "data": {
    "clientId": "uuid-here",
    "externalId": "NIT123456",
    "name": "Acme Corp",
    "created": true
  }
}
```

**Response (updated existing):**

```json
{
  "error": null,
  "data": {
    "clientId": "uuid-here",
    "externalId": "NIT123456",
    "name": "Acme Corp",
    "created": false
  }
}
```

## Key Files

- **Filipo endpoint**: `Filipo-Web/app/api/v1/customers/route.ts` (POST handler)
- **Motor sync helper**: `motor-parts-system/src/lib/filipo-client-sync.ts`
- **Wired in**: `motor-parts-system/src/app/api/users/route.ts` and `motor-parts-system/src/app/api/auth/register/route.ts`
