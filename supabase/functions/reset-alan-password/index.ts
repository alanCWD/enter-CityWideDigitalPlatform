/**
 * Disabled. This endpoint previously reset a hardcoded account password to a
 * fixed value and was reachable with only the public anon key, which allowed
 * anyone to take over that account. Password changes now go through
 * `cw-secure-reset`, which acts only on the authenticated caller.
 */
Deno.serve(() =>
  new Response(JSON.stringify({ error: "This endpoint has been disabled." }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  })
);
