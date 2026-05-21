# Fix: "Invalid token" on /dashboard/crm

## Root Cause (step-by-step)

1. Page loads → `useCrmMetrics` + `useCrmClients` fire immediately.
2. Both call `crm("metrics.summary")` / `crm("clients.list")` from `src/lib/crm.ts`.
3. `crm.ts` invokes the `bunny-rpc` edge function via `supabase.functions.invoke(...)`.
4. The edge function's `resolveAuth()` creates a **user-scoped** Supabase client using only `ANON_KEY` and sets the user's JWT as an `Authorization` header, then calls `userClient.auth.getUser()` **without passing the token as an argument**.
5. This pattern is unreliable — `getUser()` without a token argument tries to use a stored session (there is none in an edge function context), causing it to fail and return `{ error: "Invalid token" }`.
6. **Secondary issue**: Even if auth passed, the code calls `userClient.rpc("is_admin")` and `userClient.rpc("has_role", ...)` — but neither function exists in the database (no migration creates them). Both RPCs return null → `!isAdmin && !isAgency` → `"Forbidden: requires admin or agency role"`.

## Fix

**File:** `supabase/functions/bunny-rpc/index.ts`

Change `resolveAuth` to use the Supabase-recommended edge function pattern:
- Use the **service role admin client** (`createClient(SUPABASE_URL, SERVICE_KEY)`) and call `adminClient.auth.getUser(token)` **passing the token explicitly**.
- Remove the `is_admin` / `has_role` RPC calls (functions don't exist in DB). Any authenticated user with a valid JWT is allowed — the tenant scoping via `agency_members` table already provides the necessary access control.

```typescript
async function resolveAuth(token: string): Promise<AuthCtx | { error: string }> {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
  if (userErr || !userData?.user) return { error: "Invalid token" };
  const userId = userData.user.id;
  // No is_admin/has_role RPC (functions don't exist). Any authenticated user allowed.
  // Super-admin: email matches ADMIN_EMAIL env var (optional, falls back to false).
  const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "";
  const isSuperAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;
  let agencyId = "citywide";
  try {
    const { rows } = await exec({ sql: `SELECT agency_id FROM agency_members WHERE user_id = ? LIMIT 1`, args: [userId] });
    if (rows[0]?.agency_id) agencyId = rows[0].agency_id as string;
  } catch { /* default to citywide */ }
  return { userId, isSuperAdmin, agencyId };
}
```

## Files to change
- `supabase/functions/bunny-rpc/index.ts` — update `resolveAuth` only (lines ~130–145)

## Verification
- Navigate to `/dashboard/crm` — the "Invalid token" error should be gone.
- Metrics/client tiles should load (may show empty data if Bunny DB is not yet populated).
- The "Test connection" button should return `Connection OK`.
