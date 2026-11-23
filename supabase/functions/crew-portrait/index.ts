const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * One-task image pipeline used to compose the Crew portraits from a source photo.
 * Submit with { prompt, resource_url, ratio }; read the result with { task_id }.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const token = Deno.env.get("AI_API_TOKEN_5831877fc23c");
  if (!token) return json(500, { success: false, message: "AI service is not configured" });

  try {
    const body = await req.json();

    if (body.task_id) {
      const response = await fetch(`https://api.enter.pro/code/api/v1/ai/tasks/${body.task_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      return json(response.ok ? 200 : response.status, data);
    }

    if (!body.prompt || !body.resource_url) {
      return json(400, { success: false, message: "prompt and resource_url are required" });
    }

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Async": "true",
        "X-Enter-Project-ID": "5831877fc23c4834938c8f0f2295f49b",
      },
      body: JSON.stringify({
        model: "doubao/seedream-5",
        prompt: body.prompt,
        type: "img_2_img",
        resource_url: body.resource_url,
        image_option: {
          type: "img_2_img",
          ratio: body.ratio ?? "3:4",
          resolution: "2k",
          format: "png",
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(response.status, {
        success: false,
        message: data.error?.message || data.message || "Image submission failed",
      });
    }

    return json(200, { success: true, task_id: data.task_id, status: data.status });
  } catch (error) {
    return json(500, { success: false, message: error instanceof Error ? error.message : "Internal error" });
  }
});
