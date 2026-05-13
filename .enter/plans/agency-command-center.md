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
   `payments` tab shows the new row.
7. **Theme** — Toggle the light/dark switch on any CRM screen; surfaces flip cleanly.

---

# Phase 2 — Client Vault: Notes, Credentials & Files (multi-agency)

## Context

Each client now needs a per-client knowledge base ("Vault") that holds:

1. **Notes** — internal write-ups (project briefs, meeting summaries, instructions).
2. **Credentials** — login URLs, usernames, passwords, API keys, MFA recovery codes,
   etc. used by CityWide Digital staff to do future work on the client's accounts.
3. **Files** — logos, brand assets, signed contracts, PDFs.

Two visibility tiers are required:

- **agency_only** — internal CityWide Digital / white-label partner agency only.
- **client_visible** — also surfaced in the client's own portal (`/portal/:id`).

A third concept — *white-label tenancy* — must be introduced **at the same time** so a
partner agency reselling our platform can see only its own clients/vault items, while
CityWide admins still see everything.

## Decisions (locked in)

| Question | Choice |
|---|---|
| Multi-agency model | Add `agencies` table; `clients.agency_id` FK; super-admin role bypasses the filter |
| Credential encryption | None — plain text in Bunny. The Bunny DB is auth-token protected and only the edge function (server side) can read it |
| File storage | Enter Cloud Storage private bucket `client-files`; metadata rows in Bunny; signed URLs for downloads |
| v1 scope | Notes + Credentials + Files, single **Vault** tab on each client detail page |

## Architecture

```
React (Vault tab)──▶ bunny-rpc (notes/creds/files actions)──▶ Bunny DB
                                  │
                                  └──▶ Enter Cloud Storage (signed URLs only)
React (client portal)─▶ portal-vault edge function (RLS-style filter)─▶ Bunny DB
```

Two edge functions:

- **`bunny-rpc`** (existing) — gains note/credential/file CRUD actions. Filters every
  query by `agency_id` unless caller is a CityWide super-admin (`is_admin()`).
- **`portal-vault`** (new) — read-only endpoint used by `/portal/:id`; returns only items
  with `visibility = 'client_visible'` for the connection_id the user is linked to via
  `portal_users`.

## Data model (Bunny)

```sql
-- Tenancy
CREATE TABLE agencies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  is_primary   INTEGER NOT NULL DEFAULT 0,   -- 1 = CityWide Digital
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Maps Supabase auth user → agency + role (member|admin)
CREATE TABLE agency_members (
  user_id      TEXT NOT NULL,                -- auth.users.id (uuid stringified)
  agency_id    TEXT NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, agency_id)
);
ALTER TABLE clients ADD COLUMN agency_id TEXT;             -- backfill to citywide on migration
CREATE INDEX clients_agency_idx ON clients(agency_id);

-- Vault items
CREATE TABLE vault_notes (
  id           TEXT PRIMARY KEY,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id    TEXT NOT NULL,                -- mirrored from client for fast filter
  title        TEXT NOT NULL,
  body         TEXT,                         -- markdown
  visibility   TEXT NOT NULL DEFAULT 'agency_only',  -- 'agency_only' | 'client_visible'
  pinned       INTEGER NOT NULL DEFAULT 0,
  created_by   TEXT,                         -- auth user id
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX vault_notes_client_idx ON vault_notes(client_id);

CREATE TABLE vault_credentials (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       TEXT NOT NULL,
  label           TEXT NOT NULL,             -- "Facebook Business", "WP admin"
  category        TEXT,                      -- "social" | "cms" | "hosting" | "other"
  url             TEXT,
  username        TEXT,
  password        TEXT,                      -- plain text (per decision)
  mfa_notes       TEXT,                      -- recovery codes, OTP info
  notes           TEXT,
  visibility      TEXT NOT NULL DEFAULT 'agency_only',
  created_by      TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX vault_credentials_client_idx ON vault_credentials(client_id);

CREATE TABLE vault_files (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,             -- "agency_id/client_id/<uuid>/<safe-name>"
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  size_bytes      INTEGER,
  kind            TEXT,                      -- "logo" | "contract" | "asset" | "other"
  visibility      TEXT NOT NULL DEFAULT 'agency_only',
  uploaded_by     TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX vault_files_client_idx ON vault_files(client_id);
```

Bootstrap inserts a single `agencies` row `(id='citywide', name='CityWide Digital', slug='citywide', is_primary=1)` and backfills `clients.agency_id = 'citywide'` for everything that exists today.

## Auth & visibility rules

In `bunny-rpc`:

```ts
async function effectiveAgencyId(userClient, userId) {
  // CityWide super-admin (Supabase 'admin' role) bypasses tenancy.
  const { data: isAdmin } = await userClient.rpc("is_admin");
  if (isAdmin) return { agencyId: null, isSuperAdmin: true };
  // Otherwise look up agency_members for this user (created on first login).
  const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] });
  if (!rows[0]) return { agencyId: 'citywide', isSuperAdmin: false }; // default until invited
  return { agencyId: rows[0].agency_id, isSuperAdmin: false };
}
```

Every client/vault query gets `WHERE agency_id = ?` appended unless `isSuperAdmin`.

## Enter Cloud Storage

- **Bucket**: `client-files` (private — no public access)
- **Layout**: `<agency_id>/<client_id>/<file_uuid>/<safe-filename>`
- **Upload flow**:
  1. Frontend calls `vault.files.uploadUrl` action → edge function returns a signed
     **upload** URL (1-min TTL) and the storage_path it minted.
  2. Frontend uploads the file directly to Storage via `PUT` to the signed URL.
  3. Frontend calls `vault.files.confirm` with `{ storage_path, filename, mime_type, size_bytes, kind, visibility }` → row inserted in `vault_files`.
- **Download flow**: `vault.files.download` returns a signed download URL (5-min TTL) after re-checking the row's agency_id and visibility.

This avoids streaming bytes through the edge function (faster, no payload-size cap).

## New backend actions (added to `bunny-rpc`)

| Action | Args | Returns |
|---|---|---|
| `vault.list` | `{ client_id }` | `{ notes, credentials, files }` (filtered by tenancy) |
| `vault.notes.upsert` | `{ id?, client_id, title, body, visibility, pinned }` | `{ id }` |
| `vault.notes.delete` | `{ id }` | `{ ok: true }` |
| `vault.creds.upsert` | `{ id?, client_id, label, category, url, username, password, mfa_notes, notes, visibility }` | `{ id }` |
| `vault.creds.delete` | `{ id }` | `{ ok: true }` |
| `vault.files.uploadUrl` | `{ client_id, filename, mime_type }` | `{ upload_url, storage_path, expires_at }` |
| `vault.files.confirm` | `{ client_id, storage_path, filename, mime_type, size_bytes, kind, visibility }` | `{ id }` |
| `vault.files.download` | `{ id }` | `{ url, expires_at }` |
| `vault.files.delete` | `{ id }` | `{ ok: true }` (also deletes Storage object) |
| `agencies.list` | `{}` | `{ agencies }` (super-admin only — for client form picker) |
| `agencies.create` | `{ name, slug }` | `{ id }` (super-admin only) |
| `agencies.invite` | `{ agency_id, email, role }` | `{ ok }` (super-admin only — adds an `agency_members` link on first login) |

`clients.create` and `clients.update` get an optional `agency_id`. Default = caller's
agency.

## New edge function: `portal-vault`

For the client-facing portal (`/portal/:connection_id`).

- Auth: Supabase user token; must have a `portal_users` row for the requested
  `connection_id`.
- Looks up the matching CRM client by `clients.gbp_connection_id`.
- Returns only items where `visibility = 'client_visible'`. Files come back as signed
  download URLs.

## Frontend changes

**New files**
- `src/lib/vault.ts` — types (`VaultNote`, `VaultCredential`, `VaultFile`) + thin wrappers around `crm()` for the new actions.
- `src/hooks/useVault.ts` — `useVault(clientId)` returning `{ notes, credentials, files, reload }`.
- `src/components/crm/vault/VaultPanel.tsx` — the **Vault** tab body. Three subsections (Pinned notes, Credentials, Files) with inline editors.
- `src/components/crm/vault/NoteEditor.tsx` — title + markdown body + visibility toggle + pin checkbox.
- `src/components/crm/vault/CredentialEditor.tsx` — label/category/url/username/password (with show-hide eye + copy button) / MFA / notes / visibility.
- `src/components/crm/vault/FileUploader.tsx` — drag-and-drop using the upload-URL flow; thumbnail for images.
- `src/components/crm/vault/AgencyPicker.tsx` — only rendered when `is_admin()` is true; lets super-admins assign a client to a different agency.
- `src/pages/portal/ClientVaultPanel.tsx` — read-only render of items the client is allowed to see; mounted inside the existing portal page.

**Modified files**
- `src/pages/dashboard/crm/ClientDetail.tsx` — already has a `notes` tab in `useState`. Replace the placeholder with `<VaultPanel clientId={c.id} />` and rename the tab label to **Vault**.
- `src/pages/dashboard/crm/ClientsList.tsx` + `NewClientDialog` — show agency picker for super-admins.
- `src/pages/portal/PortalConnection.tsx` (or equivalent) — add a "Files & Notes" section using `<ClientVaultPanel />`.

## Migrations & infra

1. **Bunny migration** — append the new `CREATE TABLE` statements to the `bootstrap()` call (idempotent `IF NOT EXISTS`). Run once on next cold start.
2. **Enter Cloud Storage** — create private bucket `client-files` via `supabase_migration` (`insert into storage.buckets ...`) and add policies that:
   - Block all anon access.
   - Allow service-role only (the edge function uses the service role to mint signed URLs, so no per-row Storage RLS is needed).
3. **Backfill** — on first run, the edge function inserts the CityWide agency row and runs `UPDATE clients SET agency_id = 'citywide' WHERE agency_id IS NULL`.

## Reused existing pieces

- `crm()` wrapper in `src/lib/crm.ts` — all new actions go through it.
- `StatusPill` styling tokens — reused for visibility badges.
- `is_admin()` / `has_role()` Supabase RPCs — already mounted, reused for super-admin check.
- `portal_users` table + RLS — reused by `portal-vault` to validate client access.
- `ImportClientsDialog` styling — reused for credential / file editor look.

## Verification

1. **Bootstrap** — sign in as alan@citywidedigital.ca; visit any client; the Vault tab opens with 0 items and no errors. The Bunny `agencies` table contains one row.
2. **Note** — create an internal note "Onboarding checklist" with visibility = agency_only; refresh; it appears.
3. **Credential** — add a credential `WordPress admin` (URL/user/password). Click the eye icon to reveal, copy button copies password to clipboard.
4. **File upload** — drag a 2 MB PNG logo; it uploads via signed URL; thumbnail renders; click to download (signed URL opens).
5. **Visibility — client side** — flip the note to `client_visible`; sign in as the linked GBP-portal user (different account); visit `/portal/:connection_id`; the new "Files & Notes" panel shows the note + nothing else (the agency-only credential remains hidden).
6. **Multi-agency isolation** — create a second agency `whitelabel-acme`; invite a test user; sign in as them; they see only the clients assigned to acme. Super-admin (alan) still sees both.
7. **Cleanup** — delete a file; the row disappears AND the Storage object is removed (verify via Storage explorer).

---

# Phase 3 — Per-Client Digital Health Dashboard

## Context
Agency teams (and their clients) need a single, glanceable scorecard per client that surfaces what's broken, what's missing, and what needs attention across the client's entire online footprint. Today the data lives scattered across Google Business Profile, Lighthouse audits, manual citation lookups, and tribal knowledge in spreadsheets.

This phase delivers a **Health** tab on every CRM client and a read-only mirror in the client portal. It combines:
- **Auto-derived signals** — pulled live from GBP (already synced) + Google PageSpeed Insights API (free, anonymous) + a built-in citation heuristic.
- **Manual checklist items** — agency-curated boxes the team ticks off (business email, contracts signed, brand assets uploaded, etc.).
- **Roll-up health score** — weighted 0–100 across categories so non-technical clients understand "you're at 64/100, here's how to get to 90."

## Decisions (confirmed by user)
| Topic | Choice |
|---|---|
| Where it lives | **Both** an agency-side `Health` tab AND a read-only mirror in the client portal |
| Performance score source | **Google PageSpeed Insights API** (free, no key, one-click "Run audit") |
| Search Console / GA4 | **Skip live for v1** — render placeholder "Connect" buttons (wired up Phase 4) |
| Listing accuracy | **Built-in heuristic** — curated list of ~15 directories, simple HTTPS lookups, NAP fuzzy match (no third-party API cost) |

## Architecture overview
```
┌──────────────────────────────┐         ┌────────────────────────────────┐
│ Agency CRM /clients/:id      │         │ Client Portal /portal/:id      │
│   └ Health tab (read+write)  │         │   └ Health tab (read-only)     │
└──────────────┬───────────────┘         └──────────────┬─────────────────┘
               │                                        │
               ▼                                        ▼
       supabase.functions.invoke('bunny-rpc')   supabase.functions.invoke('portal-health')
               │                                        │
               ▼                                        ▼
       ┌───────────────────────────────────────────────────────┐
       │ Bunny libSQL: health_checks, health_audits,           │
       │ health_citations, health_overrides                    │
       └───────────────┬───────────────────────────────────────┘
                       │
                       ▼ (on-demand jobs)
       ┌───────────────────────────────┬──────────────────────────────┐
       │ PageSpeed Insights API        │ Citation directory probes    │
       │ (anonymous, edge-fn fetch)    │ (HEAD/GET to ~15 sites)      │
       └───────────────────────────────┴──────────────────────────────┘
```

## Health categories & checks (v1 scope)

Each check has: `key`, `category`, `label`, `weight` (1–5), `status` (`pass` | `warn` | `fail` | `unknown` | `skipped`), `evidence` (text + optional `url` + optional metric value), `auto` (bool — set by jobs vs. manually toggled), `client_visible` (bool — agency can hide internal-only checks).

### Foundation (auto, derived from `gbp_connections` + `clients` rows)
| key | label | source |
|---|---|---|
| `has_website` | Has a website | `gbp_connections.website` non-null |
| `has_https` | Website uses HTTPS | URL starts with `https://` + reachability probe |
| `has_business_email` | Uses domain-level email (not gmail/yahoo/hotmail) | `clients.billing_email` regex against free-mail providers |
| `has_phone` | Phone number on file | `gbp_connections.phone` |
| `has_address` | Physical address on file | `gbp_connections.address` |
| `has_category` | Primary GBP category set | `gbp_connections.category` |

### Google Business Profile (auto)
| key | label | source |
|---|---|---|
| `gbp_connected` | GBP linked | row exists in `portal_users` for this client |
| `gbp_recently_synced` | Last sync < 7 days ago | `gbp_connections.last_synced_at` |
| `review_count_floor` | At least 25 Google reviews | `review_count` |
| `review_rating_floor` | Average rating ≥ 4.0 | `rating` |
| `review_response_rate` | Responses to recent reviews | placeholder (Phase 4 — add `responded` column to `gbp_reviews` table) |
| `posts_recency` | A GBP post within 30 days | placeholder (Phase 4 — pull from Posts API) |

### Website performance (auto, on-demand via PSI API)
| key | label | source |
|---|---|---|
| `lighthouse_performance` | Performance ≥ 80 | PSI `lighthouseResult.categories.performance.score` |
| `lighthouse_seo` | SEO ≥ 90 | PSI `categories.seo.score` |
| `lighthouse_accessibility` | Accessibility ≥ 90 | PSI `categories.accessibility.score` |
| `lighthouse_best_practices` | Best Practices ≥ 90 | PSI `categories.best-practices.score` |
| `core_web_vitals` | CWV pass (LCP/CLS/INP) | PSI `loadingExperience.overall_category === 'FAST'` |
| `mobile_friendly` | Mobile audit ran successfully | PSI mobile strategy completed |

### Search & Analytics (placeholders for v1, real for Phase 4)
| key | label | v1 behaviour |
|---|---|---|
| `search_console_connected` | Search Console connected | Placeholder card with **Connect Search Console** button (no-op, shows "Coming soon") |
| `ga4_connected` | Google Analytics 4 connected | Same — **Connect GA4** placeholder |
| `indexed_pages` | Pages indexed in Google | manual entry only |
| `monthly_organic_clicks` | Monthly organic clicks | manual entry only |

### Listing accuracy / citations (auto via built-in checker)
Curated directory list (15 sites): Yelp, Bing Places, Apple Maps, Facebook, Yellow Pages CA, 411.ca, Cylex, Foursquare, Better Business Bureau, MapQuest, TripAdvisor, Hotfrog, Brownbook, Manta, FindUsLocal.

For each directory we synthesise a *search URL* (`https://www.yelp.com/search?find_desc={biz_name}&find_loc={city}`), fetch it server-side, and grade it:
- `found_match` — name + city appear in HTML response → `pass`
- `found_mismatch` — name appears but phone/address differs → `warn` (NAP inconsistency)
- `not_found` → `fail`
- `unreachable` (timeout / 4xx / 5xx) → `unknown`

This is heuristic-only (we tell users so), but it gives a real, auditable starting list.

| key | label | source |
|---|---|---|
| `citation_yelp`, `citation_bing`, `citation_facebook`, … (15 total) | Listed on {Directory} | Per-directory probe result |
| `citations_overall` | Citation coverage ≥ 70% | Aggregate of the 15 |
| `nap_consistency` | NAP matches across directories | All `pass` rows have matching phone + address |

### Operations checklist (manual, agency-toggled)
| key | label | default |
|---|---|---|
| `contract_signed` | Service agreement signed | unchecked |
| `payment_method_on_file` | Stripe customer + payment method | auto from `clients.stripe_customer_id` |
| `brand_assets_uploaded` | Logo + brand kit in Vault | auto: any `vault_files` with `kind='logo'` or `'brand'` |
| `gbp_credentials_in_vault` | GBP login saved to Vault | auto: any `vault_credentials` with `category='Google Business Profile'` |
| `monthly_report_scheduled` | Monthly report cadence agreed | unchecked |
| `local_seo_active` | Active Local SEO subscription | auto from active `subscriptions` row |
| `social_active` | Active Social Marketing subscription | auto |
| `reputation_active` | Active Reputation Management subscription | auto |

## Health score
Compute server-side on each `health.summary` call:
- Each check contributes `weight` (1–5; default 2; foundation+performance+citations weighted higher).
- `pass` = full weight, `warn` = 50%, `fail` = 0, `unknown`/`skipped` = excluded from denominator.
- `score = round(100 * sum(awarded) / sum(possible))`.
- Bucket: `0-49` red ("Critical"), `50-74` orange ("Needs work"), `75-89` blue ("Healthy"), `90-100` green ("Excellent").

## Bunny data model (new tables)
```sql
-- Generic per-client check state. Both auto-pulled and manual checks stored uniformly.
CREATE TABLE IF NOT EXISTS health_checks (
  client_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id     TEXT NOT NULL DEFAULT 'citywide',
  key           TEXT NOT NULL,                      -- e.g. 'has_business_email'
  category      TEXT NOT NULL,                      -- foundation|gbp|performance|search|citations|ops
  status        TEXT NOT NULL DEFAULT 'unknown',    -- pass|warn|fail|unknown|skipped
  weight        INTEGER NOT NULL DEFAULT 2,
  auto          INTEGER NOT NULL DEFAULT 1,
  client_visible INTEGER NOT NULL DEFAULT 1,
  evidence      TEXT,                               -- short human-readable explanation
  evidence_url  TEXT,                               -- click-through (e.g. PSI report URL)
  metric_value  REAL,                               -- 0..1 score or numeric (reviews count)
  updated_by    TEXT,                               -- user_id when manual
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, key)
);
CREATE INDEX IF NOT EXISTS health_checks_agency_idx ON health_checks(agency_id);

-- One row per PageSpeed run so we can show history / trend.
CREATE TABLE IF NOT EXISTS health_audits (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  strategy        TEXT NOT NULL,                    -- mobile|desktop
  performance     REAL,
  seo             REAL,
  accessibility   REAL,
  best_practices  REAL,
  lcp_ms          INTEGER,
  cls             REAL,
  inp_ms          INTEGER,
  cwv_pass        INTEGER,                          -- 1|0
  raw_report_url  TEXT,                             -- link to PSI hosted report
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS health_audits_client_idx ON health_audits(client_id);

-- One row per directory probe run (history + last result).
CREATE TABLE IF NOT EXISTS health_citations (
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  directory    TEXT NOT NULL,                      -- 'yelp', 'bing', ...
  status       TEXT NOT NULL,                      -- pass|warn|fail|unknown
  listing_url  TEXT,
  evidence     TEXT,
  checked_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, directory)
);

-- Optional per-check overrides so agency can mark `skipped` with a reason.
-- (Stored inline on health_checks via status='skipped' + evidence; no separate table needed.)
```

## New backend actions (add to `bunny-rpc`)
- `health.summary` (read) → returns `{ score, bucket, categories: [{ category, checks: HealthCheck[] }], last_audit, last_citation_run }`. Lazy-creates default rows from check definitions on first call.
- `health.refreshAuto` (write) → re-derives all `auto=1` checks from current GBP + client data (cheap, sync, < 200 ms).
- `health.runLighthouse` (write) → calls PSI API (mobile + desktop), inserts into `health_audits`, updates the 6 lighthouse `health_checks` rows. Returns the new audit row.
- `health.runCitations` (write) → fans out to the 15 directory probes (sequential with 500ms gap, ~10 s total), updates `health_citations` + the citation `health_checks`. Returns summary.
- `health.toggleCheck` (write) → manual override: set `status` (pass/warn/fail/skipped), `evidence`, `client_visible`. Throws if `auto=1`.
- `health.setMetric` (write) → for manual numeric checks (`indexed_pages`, `monthly_organic_clicks`).

Plus a new edge function:
- `portal-health` — read-only, mirrors `health.summary` but filters to `client_visible=1` rows only. Mirrors auth pattern of `portal-vault`.

## Check-definitions catalogue
Single source of truth in a new file `supabase/functions/_shared/health-catalog.ts` (Deno module) so both `bunny-rpc` and `portal-health` share it:
```ts
export interface HealthCheckDef {
  key: string;
  category: "foundation" | "gbp" | "performance" | "search" | "citations" | "ops";
  label: string;
  weight: number;
  auto: boolean;
  client_visible_default: boolean;
  evaluator?: "derived" | "lighthouse" | "citation" | "manual";
}
export const HEALTH_CATALOG: HealthCheckDef[] = [ … 30+ entries … ];
```
Frontend gets the same list (mirrored as `src/lib/healthCatalog.ts`) for labels/icons.

## PageSpeed Insights integration
- Endpoint: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={url}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`
- No API key needed at low volume (≤ 25k/day per source IP).
- Edge function fetches mobile + desktop in parallel, both Promise.allSettled (one failure doesn't kill the whole audit).
- Store the raw report by linking to PSI's hosted UI: `https://pagespeed.web.dev/analysis?url=<encoded>`.
- Errors (timeout, invalid URL, target unreachable) → status `unknown` + evidence text.

## Citation probe heuristic
For each directory entry `{ key, name, search_url_template }`:
1. Build `searchUrl = template.replace('{q}', encodeURIComponent(business_name)).replace('{city}', encodeURIComponent(city))`.
2. `fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 …', 'Accept-Language': 'en-CA' }, signal: AbortSignal.timeout(8000) })`.
3. Lower-case body; check for `business_name` substring **and** at least one of `[city, postal_code, phone digits]`.
4. If both present → `pass`; if only name → `warn` (mismatch); if name absent → `fail`; non-2xx or timeout → `unknown`.

We **tell the user this is a heuristic** (small footnote on the citations card with a "Re-check" button) — it's not a substitute for BrightLocal but gives directional accuracy at $0/mo.

## Frontend
**New files**
- `src/lib/health.ts` — TS types + `crm("health.…")` wrappers.
- `src/lib/healthCatalog.ts` — mirror of the Deno catalogue (labels, icons via lucide map, weights).
- `src/hooks/useClientHealth.ts` — `useClientHealth(clientId)` returns `{ score, categories, audits, loading, error, refreshAuto, runLighthouse, runCitations }` with optimistic UI on mutations.
- `src/components/crm/health/HealthPanel.tsx` — top-level layout with score hero, category cards, action buttons.
- `src/components/crm/health/ScoreHero.tsx` — radial-progress 0–100, bucket label & color, "last refreshed" timestamp + **Refresh** button (calls `refreshAuto`).
- `src/components/crm/health/CategoryCard.tsx` — one card per category with collapsible check list.
- `src/components/crm/health/CheckRow.tsx` — single row: status icon (Check/Alert/X/—), label, evidence, click-through, manual override menu (agency-only kebab).
- `src/components/crm/health/LighthouseCard.tsx` — performance numbers + last 5 audits sparkline + "Run Lighthouse" button.
- `src/components/crm/health/CitationsCard.tsx` — grid of 15 directories with traffic-light dots + "Re-check now" button.
- `src/pages/portal/PortalHealth.tsx` — read-only mirror; uses `portal-health` edge function; reuses `ScoreHero`, `CategoryCard`, `CheckRow` via prop `readOnly`.

**Modified files**
- `src/pages/dashboard/crm/ClientDetail.tsx` — add `"health"` to the tab union, insert tab between `"overview"` and `"vault"`, render `<HealthPanel clientId={detail.client.id} />`.
- `src/components/portal/PortalTopBar.tsx` — add `{ name: "Health", path: "health", icon: Activity }` between `"Overview"` and `"GBP"`.
- `src/router.tsx` — add `/portal/:clientId/health` route.
- `supabase/functions/bunny-rpc/index.ts` — add the 6 new actions + bootstrap migrations (3 new tables) + import shared catalogue.
- `supabase/functions/portal-vault/index.ts` — no change (separate function).

**New backend file**
- `supabase/functions/portal-health/index.ts` — read-only summary + signed link-throughs.
- `supabase/functions/_shared/health-catalog.ts` — shared check definitions + directory list.

## Reused existing pieces
- `crm()` RPC wrapper in `src/lib/crm.ts` — no changes needed.
- `assertClientAccess` + `tenantScope` + agency_id mirroring pattern from Phase 2's vault — used identically here.
- `gbp_connections` (Supabase) joined to Bunny `clients` via `gbp_connection_id` — already used in `portal-vault`; reuse the same join helper.
- `portal_users` access check pattern from `portal-vault`.
- `useVault` hook structure (loading/error/reload) is the template for `useClientHealth`.
- Vault visibility design language (`Internal` / `Shared` badges) is reused so admins toggle individual checks the same way.

## Migrations & infra
- **Bunny migration** — append the 3 new `CREATE TABLE` statements to the `bootstrap()` function (idempotent `IF NOT EXISTS`), no Supabase migration needed.
- **No new secrets** — PSI is anonymous, citation probes are anonymous fetches.
- **No new buckets** — health audits are pure data, no files.
- **No new Supabase tables** — all health data lives in Bunny.

## Verification
1. **Foundation auto-checks** — Open a client; click `Health` tab; confirm score appears (lazy-creates rows on first load); `has_website` is green if URL exists, red if not; `has_business_email` is red if billing_email is `@gmail.com`.
2. **Refresh** — Click `Refresh` in ScoreHero; auto checks re-derive (timestamp updates); manual checks unchanged.
3. **Lighthouse** — Enter a website URL on a real client (e.g. citywidedigital.ca); click `Run Lighthouse`; spinner ~12 s; performance/SEO/CWV cards populate; click "View full report" → opens PSI hosted page.
4. **Citations** — Click `Re-check listings`; ~10 s probe; ≥ 10 of 15 directories return a status (some `unknown` is OK); aggregate `citations_overall` updates.
5. **Manual override** — Open a check's kebab menu; mark "Skip — N/A"; row goes grey; score recalculates excluding it.
6. **Visibility — agency only** — Toggle `gbp_credentials_in_vault` to `internal`; load the portal as a portal-user — that row is absent; the score in the portal differs (it's recomputed only over `client_visible` items so clients see a clean view).
7. **Multi-agency isolation** — Same as Phase 2: a `whitelabel-acme` user can only run health audits on their own clients; `assertClientAccess` blocks cross-agency requests.
8. **Score bucket** — Manually fail enough checks on a test client that score < 50; hero turns red and reads "Critical".
