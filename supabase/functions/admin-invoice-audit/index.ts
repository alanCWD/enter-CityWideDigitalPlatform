// Disabled — was a temporary one-off backfill/diagnostic tool, no longer needed.
Deno.serve(() => new Response("Gone", { status: 410 }));
