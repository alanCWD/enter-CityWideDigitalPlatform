# GBP Auto-Connect Plan

## Context
The OAuth infrastructure already exists and is fully functional:
- `gbp-auth-url` → generates Google OAuth URL
- `gbp-auth-callback` → after OAuth: exchanges tokens, fetches ALL GBP data (NAP, reviews, posts), upserts into `gbp_connections` + `gbp_reviews` + `gbp_posts`
- `gbp-sync` → re-sync using stored refresh tokens

**Two things are missing:**
1. After OAuth, the CRM client's `gbp_connection_id` (in BunnyDB) is never set
2. The portal `/portal/connect` page shows "Pending setup" — clients can't self-connect

## What changes

### 1. `supabase/functions/gbp-auth-url/index.ts`
Accept `crmClientId` in the POST body and include it in the OAuth `state` payload.
```
state = btoa(JSON.stringify({ clientLabel, frontendOrigin, linkUserId, crmClientId }))
```

### 2. `supabase/functions/gbp-auth-callback/index.ts`
- Extract `crmClientId` from parsed state
- After the `gbp_connections` row is created/updated (step 5 in existing code), if `crmClientId` is truthy:
  - Use the same BunnyDB HTTP pipeline format as `bunny-rpc` to run:
    `UPDATE clients SET gbp_connection_id = ?, updated_at = ? WHERE id = ?`
  - Uses `BUNNY_DB_URL` + `BUNNY_DB_AUTH_TOKEN` env vars (shared across all edge functions)
- Update redirect logic:
  - If `crmClientId` AND no `linkUserId`: redirect to `/dashboard/crm/clients/{crmClientId}?gbp=connected`
  - If `linkUserId`: existing behavior — redirect to `/portal/{connectionId}?status=connected`
  - Default: existing `/gbp?status=connected` behavior

### 3. `src/pages/portal/PortalConnect.tsx`
Replace "Pending agency setup" with a real GBP connect flow:
- Show "Connect Your Google Business Profile" button
- On click: call `gbp-auth-url` with `{ clientLabel: user.email, frontendOrigin, linkUserId: user.id }`
- Read optional `crmClientId` from URL search params (passed by agency when generating link)
- Show a simple loading state while redirecting

### 4. `src/components/dashboard/crm/LinkZernioProfileDialog.tsx`
Add a third view: "Connect with Google"
- New tab/section: "Connect via Google OAuth"
- On click: call `gbp-auth-url` with `{ clientLabel: clientName, frontendOrigin: window.location.origin, crmClientId }`
- Redirect to Google OAuth → all data syncs → CRM client linked automatically
- This replaces the manual "Create New Profile" form as the primary action

## Files to modify
1. `supabase/functions/gbp-auth-url/index.ts`
2. `supabase/functions/gbp-auth-callback/index.ts`
3. `src/pages/portal/PortalConnect.tsx`
4. `src/components/dashboard/crm/LinkZernioProfileDialog.tsx`

## BunnyDB update format (reuse from bunny-rpc)
```typescript
const bunnyBase = (Deno.env.get("BUNNY_DB_URL") ?? "")
  .trim().replace(/\/$/, "").replace(/^libsql:\/\//i, "https://");
await fetch(`${bunnyBase}/v2/pipeline`, {
  method: "POST",
  headers: { "Authorization": `Bearer ${Deno.env.get("BUNNY_DB_AUTH_TOKEN")}`, "Content-Type": "application/json" },
  body: JSON.stringify({ requests: [
    { type: "execute", stmt: { sql: "UPDATE clients SET gbp_connection_id = ?, updated_at = ? WHERE id = ?",
      args: [{ type: "text", value: connectionId }, { type: "text", value: new Date().toISOString() }, { type: "text", value: crmClientId }] } },
    { type: "close" }
  ]}),
});
```

## Result (end-to-end flows)

**Agency-initiated (from CRM client page):**
1. Agency opens HyperDrii → clicks "Link Business Profile" → "Connect with Google"
2. Redirected to Google OAuth (agency signs in with management account)
3. Callback: syncs all NAP/reviews/posts → updates BunnyDB `clients.gbp_connection_id`
4. Redirected to `/dashboard/crm/clients/hyperdrii-2?gbp=connected`
5. Client page reloads — portal now active, GBP tab visible, all data populated

**Client self-connect (via portal):**
1. Client receives portal invite → logs in → lands on `/portal/connect`
2. Sees "Connect Google Business Profile" button (not "Pending setup")
3. Clicks → Google OAuth with their own business Google account
4. Callback: syncs all data → links `portal_users` → redirects to `/portal/{id}?status=connected`
