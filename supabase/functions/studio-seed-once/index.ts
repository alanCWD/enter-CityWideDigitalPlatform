// Disabled. The sandbox accounts this function created already exist, and it
// must never write again. Kept as a 410 stub so the name stays reserved.
Deno.serve(() => new Response("Gone", { status: 410 }));
