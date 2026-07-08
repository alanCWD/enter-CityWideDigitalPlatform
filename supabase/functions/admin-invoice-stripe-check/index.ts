// Disabled — was a temporary one-off diagnostic tool, no longer needed.
Deno.serve(() => new Response("Gone", { status: 410 }));
