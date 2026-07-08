Deno.serve(() => new Response(JSON.stringify({ marker: "TEST123-FRESH" }), { headers: { "Content-Type": "application/json" } }));
