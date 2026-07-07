# Plan: QuickBooks Online → Review Request Integration

## Context
When a CRM client's QuickBooks Online invoice is marked as **paid**, automatically email the end-customer (from the QBO invoice) a review request linking to that client's Google Business Profile review page. The QBO connection is configured **per CRM client** in the ClientDetail page. Email is sent via **Resend**. No SMS for now.

---

## Architecture Overview

```
Agency connects QBO per-client  →  qbo-auth-url  →  QBO OAuth  →  qbo-auth-callback
                                                                          ↓
QBO marks invoice paid  →  QBO webhook  →  qbo-webhook (edge fn)
                                                  ↓
                               Fetch invoice + customer from QBO API
                                                  ↓
                               Look up GBP review URL for that client
                                                  ↓
                               Send email via Resend API
                                                  ↓
                               Log to review_requests table
```

---

## 1. Database Migration (single migration file)

```sql
-- QBO credentials per CRM client
CREATE TABLE quickbooks_connections (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_client_id text NOT NULL UNIQUE,   -- FK → clients.id (Bunny DB side)
  realm_id      text NOT NULL,           -- QBO company ID
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  token_expiry  timestamptz NOT NULL,
  review_link   text,                    -- agency-entered GBP short review URL
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE quickbooks_connections ENABLE ROW LEVEL SECURITY;
-- Service-role only (edge functions use service key)
CREATE POLICY "service_role_only" ON quickbooks_connections
  USING (auth.role() = 'service_role');

-- Log of sent review requests
CREATE TABLE review_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_client_id   text NOT NULL,
  qbo_invoice_id  text NOT NULL UNIQUE,   -- prevent duplicate sends
  customer_name   text,
  customer_email  text NOT NULL,
  review_link     text,
  status          text NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error_message   text,
  sent_at         timestamptz DEFAULT now()
);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON review_requests
  USING (auth.role() = 'service_role');
```

---

## 2. Secrets Required (collect via supabase_add_secret)

| Secret | Purpose |
|---|---|
| `QBO_CLIENT_ID` | QBO app OAuth client ID |
| `QBO_CLIENT_SECRET` | QBO app OAuth client secret |
| `QBO_WEBHOOK_VERIFIER_TOKEN` | HMAC verifier for QBO webhook payloads |
| `RESEND_API_KEY` | Resend API key for sending emails |

---

## 3. New Edge Functions

### `qbo-auth-url/index.ts`
- **Pattern**: mirrors `gbp-auth-url` exactly
- **Input**: `{ crmClientId, frontendOrigin }`
- **Action**: build QBO OAuth URL with state = `btoa({ crmClientId, frontendOrigin })`
- **QBO OAuth endpoint**: `https://appcenter.intuit.com/connect/oauth2`
- **Scope**: `com.intuit.quickbooks.accounting`
- **redirect_uri**: `${frontendOrigin}/qbo/callback`

### `qbo-auth-callback/index.ts`
- **Pattern**: mirrors `gbp-auth-callback` (token exchange → store)
- **Input**: `{ code, state, redirectUri }`
- **Action**:
  1. Exchange code at `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
  2. Extract `realmId` from token response
  3. Upsert into `quickbooks_connections` (Supabase)
- **Returns**: `{ success, crmClientId, realmId }`

### `qbo-webhook/index.ts`
- **Trigger**: POST from QuickBooks when entity changes
- **Steps**:
  1. Verify HMAC-SHA256 signature using `QBO_WEBHOOK_VERIFIER_TOKEN`
  2. Parse payload; skip if not an `Invoice` or `Payment` entity
  3. For each relevant entity: fetch full invoice from QBO API using stored tokens (auto-refresh if expired)
  4. Check `Invoice.Balance === 0` (fully paid); skip otherwise
  5. Check `review_requests` table — skip if `qbo_invoice_id` already exists (idempotent)
  6. Fetch `quickbooks_connections` by `realm_id` to get `crm_client_id` + `review_link`
  7. Send email via Resend:
     - **To**: customer email from QBO invoice
     - **From**: `reviews@citywidedigital.ca` (or configured sender)
     - **Subject**: "Thanks for your business — leave us a review?"
     - **Body**: Short HTML email with review button linking to `review_link`
  8. Insert into `review_requests` with status 'sent' or 'failed'

**Token refresh helper**: if `token_expiry < now()`, call `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` with `grant_type=refresh_token` and update stored tokens.

---

## 4. New Frontend Page: `src/pages/QboCallback.tsx`
- **Pattern**: mirrors `src/pages/dashboard/GbpCallback.tsx`
- Reads `?code=&state=&realmId=` from URL (QBO appends `realmId` to redirect URI)
- Calls `qbo-auth-callback` edge function
- On success: redirects to `/dashboard/crm/clients/:crmClientId?qbo=connected`
- On failure: redirects with `?qbo_error=...`

---

## 5. Router Update (`src/router.tsx`)
Add:
```tsx
import QboCallback from "./pages/QboCallback";
// ...
{ path: "/qbo/callback", name: "qbo-callback", element: <QboCallback /> }
```

---

## 6. ClientDetail.tsx Updates (`src/pages/dashboard/crm/ClientDetail.tsx`)

### Tab strip
Add `"quickbooks"` to the tab type union alongside existing `"overview" | "health" | "vault" | ...`

### Handle callback query param
Add `qbo=connected` / `qbo_error=` handling in the existing `useEffect` that currently handles `gbp=connected`.

### QuickBooks tab UI
- **Not connected**: description + "Connect QuickBooks" button → calls `qbo-auth-url`, then `window.location.href` to QBO
- **Connected**: shows realm ID, disconnect button, editable review link field (save to `quickbooks_connections.review_link`)
- **Review requests table**: columns — Date, Customer, Email, Status — fetched from `review_requests` where `crm_client_id = id`, ordered by `sent_at DESC`

---

## 7. Data Fetch Hook: `src/hooks/useQuickbooks.ts`
New hook, following the pattern of `useCrm.ts`:
- `useQboConnection(clientId)` — fetches `quickbooks_connections` row for this client
- `useReviewRequests(clientId)` — fetches recent `review_requests` for this client

---

## Files Modified / Created

| File | Action |
|---|---|
| `supabase/migrations/migration_YYYYMMDD_qbo` | CREATE (migration) |
| `supabase/functions/qbo-auth-url/index.ts` | CREATE |
| `supabase/functions/qbo-auth-callback/index.ts` | CREATE |
| `supabase/functions/qbo-webhook/index.ts` | CREATE |
| `src/pages/QboCallback.tsx` | CREATE |
| `src/hooks/useQuickbooks.ts` | CREATE |
| `src/router.tsx` | ADD route |
| `src/pages/dashboard/crm/ClientDetail.tsx` | ADD tab + callback handling |

---

## Secrets Collection Order
Before implementation: prompt user to input `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_WEBHOOK_VERIFIER_TOKEN`, `RESEND_API_KEY` via `supabase_add_secret`.

---

## Verification
1. **Auth flow**: click "Connect QuickBooks" on a client → QBO login → redirects back → tab shows "Connected" + realm ID
2. **Webhook**: use QBO sandbox to mark a test invoice as paid → verify review request appears in the table + email arrives (Resend dashboard)
3. **Duplicate guard**: marking same invoice paid twice → only one row in `review_requests`
4. **Token refresh**: wait for token expiry, then trigger a webhook → tokens auto-refresh, email still sends
