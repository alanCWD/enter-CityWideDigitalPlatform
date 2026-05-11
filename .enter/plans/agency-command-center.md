# CRM + Billing on Bunny Database

## Context

The agency dashboard already manages GBP connections and a client portal, but CityWide
Digital has no system of record for **who its paying customers are, what they bought, and
whether they've paid**. We need a CRM-grade client database that:

1. Stores companies, contacts, and the agency's own product/plan catalog
2. Supports both one-off (à la carte) and recurring (subscription) line items
3. Generates invoices, emails them, and collects card / ACH payment via Stripe
4. Stays loosely linked to the existing GBP connection so each client is one record

The user has provisioned a **Bunny Database** (libSQL/SQLite-compatible, HTTP-driven) and
will supply the connection URL + auth token. CRM data lives in Bunny; **auth, GBP, and
portal data stay in Enter Cloud (Supabase)** — they each do what they're best at.

---

## Architecture

```
 ┌──────────────────────────┐         ┌──────────────────────────┐
 │  React dashboard         │  fetch  │  Edge Function: bunny-rpc │
 │  /dashboard/crm/*        │────────▶│  (auth-checked router)    │
 └──────────────────────────┘         └──────────┬───────────────┘
            ▲                                    │ libSQL HTTP
            │                                    ▼
            │  invoke()                ┌──────────────────────────┐
            │                          │  Bunny Database          │
            │                          │  (clients, products,     │
            │                          │   subscriptions,         │
            │                          │   invoices, payments)    │
            │                          └──────────────────────────┘
            │
            │  Stripe webhooks ───▶ Edge Function: stripe-webhook ──▶ Bunny
```

**Why this split**

- Bunny libSQL has no native row-level security; an Edge Function gateway enforces
  agency/admin auth using the existing `is_admin()` / `useUserRole` system.
- Stripe is the source of truth for money state; Bunny mirrors invoice/payment status via
  webhook so the dashboard renders without round-tripping Stripe.
- Linking to GBP is by `gbp_connection_id` (just the UUID string) — no FK across systems,
  but the UI joins them in the gateway's responses.

---

## Secrets to add (via `supabase_add_secret`)

| Secret name              | Source                                                 |
|--------------------------|--------------------------------------------------------|
| `BUNNY_DB_URL`           | Bunny dashboard → Database → Connection URL (HTTP)     |
| `BUNNY_DB_AUTH_TOKEN`    | Bunny dashboard → Database → Auth token                |
| `STRIPE_SECRET_KEY`      | Collected via `stripe_enable` tool (handles validation)|
| `STRIPE_WEBHOOK_SECRET`  | Stripe dashboard → Webhooks → endpoint signing secret  |

---

## Bunny Database schema

All tables created via a one-shot bootstrap call from the Edge Function on first request
(checked with `CREATE TABLE IF NOT EXISTS`). Money in **integer cents**; timestamps in
**ISO-8601 text** (libSQL convention).

```sql
-- Companies / clients (the billed entity)
CREATE TABLE IF NOT EXISTS clients (
  id                TEXT PRIMARY KEY,            -- uuid
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | paused | churned | lead
  gbp_connection_id TEXT,                        -- soft link to Supabase gbp_connections
  stripe_customer_id TEXT,
  billing_email     TEXT,
  phone             TEXT,
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  region            TEXT,
  postal_code       TEXT,
  country           TEXT DEFAULT 'CA',
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS clients_gbp_idx    ON clients(gbp_connection_id);
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status);

-- Contacts (people inside a client company)
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        TEXT,                              -- e.g. 'Owner', 'Manager'
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS contacts_client_idx ON contacts(client_id);

-- Catalog: products and plans CityWide sells
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  type              TEXT NOT NULL,               -- 'one_off' | 'subscription'
  unit_amount_cents INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CAD',
  interval          TEXT,                        -- null | 'month' | 'year' (subs only)
  stripe_product_id TEXT,
  stripe_price_id   TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Active subscriptions per client
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       TEXT PRIMARY KEY,
  client_id                TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id               TEXT NOT NULL REFERENCES products(id),
  quantity                 INTEGER NOT NULL DEFAULT 1,
  status                   TEXT NOT NULL,        -- trialing|active|past_due|canceled
  current_period_start     TEXT,
  current_period_end       TEXT,
  cancel_at_period_end     INTEGER NOT NULL DEFAULT 0,
  stripe_subscription_id   TEXT UNIQUE,
  created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS subs_client_idx ON subscriptions(client_id);

-- Invoices (mirror of Stripe invoices + agency-issued one-offs)
CREATE TABLE IF NOT EXISTS invoices (
  id                 TEXT PRIMARY KEY,
  client_id          TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  number             TEXT,                       -- e.g. CWD-2026-0001
  status             TEXT NOT NULL,              -- draft|open|paid|void|uncollectible
  subtotal_cents     INTEGER NOT NULL DEFAULT 0,
  tax_cents          INTEGER NOT NULL DEFAULT 0,
  total_cents        INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents  INTEGER NOT NULL DEFAULT 0,
  currency           TEXT NOT NULL DEFAULT 'CAD',
  stripe_invoice_id  TEXT UNIQUE,
  hosted_invoice_url TEXT,
  pdf_url            TEXT,
  due_date           TEXT,
  issued_at          TEXT,
  paid_at            TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS invoices_client_idx ON invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);

-- Line items on an invoice
CREATE TABLE IF NOT EXISTS invoice_items (
  id              TEXT PRIMARY KEY,
  invoice_id      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES products(id),
  description     TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_amount_cents INTEGER NOT NULL,
  amount_cents    INTEGER NOT NULL              -- quantity * unit_amount_cents
);

-- Payments (each successful Stripe charge)
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  invoice_id        TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'CAD',
  method            TEXT,                        -- 'card' | 'ach' | 'manual'
  stripe_payment_id TEXT UNIQUE,
  paid_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS payments_client_idx ON payments(client_id);
```

---

## Edge Functions (new)

### 1. `bunny-rpc` — single CRM gateway
Path: `supabase/functions/bunny-rpc/index.ts`

A small RPC router that:
- Verifies the caller's Supabase JWT and checks `is_admin()` or `has_role('agency')`
- Forwards typed actions to Bunny Database via `fetch(BUNNY_DB_URL, …)` (libSQL HTTP API,
  POST `/v2/pipeline` with `{ requests: [{ type: 'execute', stmt: { sql, args }}] }`)
- One-time `bootstrap()` runs `CREATE TABLE IF NOT EXISTS …` on cold start

Action surface (all `POST { action, payload }`):
```
clients.list({ q?, status?, limit?, cursor? })
clients.get({ id }) → client + contacts + active subscriptions + recent invoices
clients.create({ … }) / update({ id, … }) / archive({ id })
contacts.upsert({ … }) / delete({ id })
products.list() / upsert({ … }) / archive({ id })   // also syncs Stripe product+price
subscriptions.create({ client_id, product_id, qty }) → calls Stripe + writes mirror row
subscriptions.cancel({ id, at_period_end })
invoices.list({ client_id?, status? })
invoices.create({ client_id, items, due_date }) → creates draft Stripe Invoice
invoices.send({ id }) → Stripe invoices.sendInvoice (emails the hosted invoice)
invoices.void({ id })
payments.list({ client_id })
metrics.summary()  → { mrr, outstanding_cents, active_clients, overdue_count }
```

### 2. `stripe-webhook` — payment + invoice sync
Path: `supabase/functions/stripe-webhook/index.ts`

Handles:
- `invoice.created`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`,
  `invoice.voided`
- `customer.subscription.created/updated/deleted`
- `payment_intent.succeeded` (one-off Payment Links)

Verifies signature with `STRIPE_WEBHOOK_SECRET`, then upserts the matching row in Bunny.

### 3. (reuse) Existing `stripe_enable`
Captures `STRIPE_SECRET_KEY`. We then add `STRIPE_WEBHOOK_SECRET` via
`supabase_add_secret`.

---

## Frontend

New CRM section in the dashboard, mounted at `/dashboard/crm`.

```
src/pages/dashboard/crm/
  CrmIndex.tsx          // dashboard cards: MRR, outstanding, overdue, recent activity
  ClientsList.tsx       // searchable + filterable table
  ClientDetail.tsx      // tabs: Overview · Subscriptions · Invoices · Payments · Notes
  Catalog.tsx           // products & plans editor (syncs Stripe in background)
  InvoiceComposer.tsx   // line-item builder → "Send invoice" button
src/components/crm/
  ClientForm.tsx
  ContactsEditor.tsx
  SubscriptionPicker.tsx
  InvoiceTable.tsx
  StatusPill.tsx        // reuses theme tokens
  GbpLinkBadge.tsx      // shows "Linked to <business>" pulled from Supabase
src/hooks/
  useCrm.ts             // typed wrapper around supabase.functions.invoke('bunny-rpc',…)
```

Sidebar nav (in `src/components/dashboard/Sidebar.tsx`): insert **CRM & Billing**
(`Receipt` icon from lucide-react) above **Forum**.

GBP cross-link: in `ClientDetail`, when `gbp_connection_id` is set, fetch the matching row
from `gbp_connections` and render the existing `NapDetails`-style summary; offer an
"Unlink" / "Pick GBP…" combobox that searches `gbp_connections` (reuses `ClientSearch`
patterns).

All UI uses the existing dashboard tokens (`#0078D7`, `#22C55E`, `#0D1526`, etc.) and
respects the dark/light `theme-light` toggle (no extra rules needed because we'll use
the same arbitrary classes already covered by `dashboard-theme.css`).

---

## Files to create / modify

**Create**
- `supabase/functions/bunny-rpc/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `src/lib/bunny.ts`            — typed `crm()` client wrapping `functions.invoke`
- `src/hooks/useCrm.ts`
- `src/pages/dashboard/crm/{CrmIndex,ClientsList,ClientDetail,Catalog,InvoiceComposer}.tsx`
- `src/components/crm/{ClientForm,ContactsEditor,SubscriptionPicker,InvoiceTable,StatusPill,GbpLinkBadge}.tsx`

**Modify**
- `src/router.tsx` — add `/dashboard/crm`, `/dashboard/crm/clients`,
  `/dashboard/crm/clients/:id`, `/dashboard/crm/catalog`
- `src/components/dashboard/Sidebar.tsx` — new "CRM & Billing" nav item
- `src/components/dashboard/TopBar.tsx` — surface "+ New Invoice" quick-action when on
  CRM routes (reuses the existing `action` prop pattern)

**No changes to existing Supabase tables** — the GBP link is a soft string FK.

---

## Reused utilities

- `src/hooks/useUserRole.ts` (admin/agency gate inside `bunny-rpc`)
- `src/hooks/useTheme.tsx` (CRM screens render correctly in both themes)
- `src/components/dashboard/{TopBar,Sidebar,DashboardLayout}.tsx` (consistent shell)
- `src/integrations/supabase/client.ts` for `functions.invoke('bunny-rpc')`
- `cn()` from `src/lib/utils.ts` for class composition
- `lucide-react` icons (no emoji)

---

## Verification

1. **Connectivity** — Open `/dashboard/crm`; the gateway runs bootstrap and reports
   "Bunny: connected · 0 clients". Confirm tables exist via a follow-up `metrics.summary`
   call returning zeros.
2. **Catalog sync** — Create a "Local SEO Pro – $299/mo" subscription product. Confirm a
   Stripe product + price are created (visible in Stripe dashboard).
3. **Client lifecycle** — Create a client, attach a contact, link a GBP connection from
   the picker; the GBP card renders.
4. **Subscription** — Add the SEO Pro plan to the client; Stripe creates a subscription;
   the dashboard shows status `active` and projected MRR updates.
5. **Invoicing** — Compose a one-off invoice (e.g. "Logo refresh – $400"), click **Send**;
   the client receives the Stripe-hosted invoice email.
6. **Payment** — Pay the invoice in Stripe test mode (card `4242 4242 4242 4242`); within
   seconds the webhook flips the row to `paid`, MRR / outstanding tiles update, and the
   `payments` tab shows the new row.
7. **Theme** — Toggle the light/dark switch on any CRM screen; surfaces flip cleanly.
