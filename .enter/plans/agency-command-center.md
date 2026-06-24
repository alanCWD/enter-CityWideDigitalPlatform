# Stripe Integration Plan

## Context
The CRM (backed by BunnyDB via `bunny-rpc`) already has invoices, subscriptions, and payments tables with UI. Currently all billing is local only — no Stripe calls. The user wants:
- Full Stripe invoice flow: create → finalize → email client Stripe payment link
- Products/services managed FROM the app (synced to Stripe)
- Subscriptions via Stripe recurring billing

`STRIPE_SECRET_KEY` is stored in secrets. `STRIPE_WEBHOOK_SECRET` still needed (user registers webhook endpoint after deploy).

## What Changes

### 1. `supabase/functions/bunny-rpc/index.ts` — Add Stripe calls
Import `Stripe` from `https://esm.sh/stripe@14.21.0?target=deno`. Init with `STRIPE_SECRET_KEY`.

**`products.create`** (new action) → Create Stripe Product + Price, save `stripe_product_id` + `stripe_price_id` to BunnyDB.

**`products.update`** (new action) → Update Stripe Price if amount/interval changes (archive old price, create new one).

**`clients.ensure_stripe_customer`** (internal helper) → If client has no `stripe_customer_id`, create one in Stripe using `billing_email` + `name`, save back to BunnyDB client row.

**`invoices.send`** (update existing) → 
1. Ensure Stripe customer exists
2. Create Stripe Invoice with `collection_method: send_invoice`, `days_until_due`
3. Add line items to Stripe Invoice (InvoiceItems)
4. Finalize Stripe Invoice → get `hosted_invoice_url` + `invoice_pdf`
5. Send Stripe Invoice email
6. Update BunnyDB row: `stripe_invoice_id`, `hosted_invoice_url`, `pdf_url`, `status = open`, `sent_at`

**`subscriptions.create`** (update existing) →
1. Ensure Stripe customer exists  
2. Look up product's `stripe_price_id`
3. Create Stripe Subscription  
4. Update BunnyDB `subscriptions` row with `stripe_subscription_id`

### 2. New page: `/dashboard/billing/products` — Products & Services Manager
- List all products from `products.list`  
- Add/edit/archive product form:  
  - Name, Description, Type (one-off / subscription), Amount, Currency (CAD), Interval (month/year, if subscription)  
  - On save → calls `products.create` or `products.update` (bunny-rpc) which syncs to Stripe  
- Shows `stripe_price_id` badge when synced

### 3. `supabase/functions/stripe-webhook/index.ts` — Already handles events
Just need to verify it reads `STRIPE_WEBHOOK_SECRET` from env (it does). No code changes needed — it already upserts invoices/payments/subscriptions into BunnyDB.

### 4. Sidebar / Router — Add Products page
Add "Products & Services" link in Sidebar under Billing section.  
Add route `/dashboard/billing/products` → new `Products.tsx` page.

### 5. Stripe Webhook Registration (manual step for user)
After deploy, user must:
1. Stripe Dashboard → Developers → Webhooks → Add endpoint  
2. URL: `https://spb-t4n1w2j9jwhhc7h6.supabase.opentrust.net/functions/v1/stripe-webhook`  
3. Events: `invoice.*`, `customer.subscription.*`, `payment_intent.succeeded`  
4. Copy signing secret → Add as `STRIPE_WEBHOOK_SECRET` in secrets

## Files to Modify
- `supabase/functions/bunny-rpc/index.ts` — add Stripe integration (~80 lines added to existing actions)
- `src/pages/dashboard/billing/affiliates.tsx` — replace placeholder with real billing overview
- **New**: `src/pages/dashboard/billing/Products.tsx`
- `src/router.tsx` — add Products route
- `src/components/dashboard/Sidebar.tsx` — add Products nav link

## Verification
1. Create a product → appears in Stripe Dashboard → Products
2. Open a client → Invoices tab → New Invoice → add line items → Send → client email arrives with Stripe payment link
3. Add Subscription to client → Stripe Dashboard shows active subscription
4. Stripe webhook fires on payment → invoice status updates to "paid" in CRM
