const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Moonshot official international endpoint. Hardcoded — not a secret.
const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = "kimi-k2-0905-preview";
const DEFAULT_MAX_TOKENS = 8192;

function errorResponse(status: number, message: string, type = "api_error") {
  const errorSSE = `event: error\ndata: ${JSON.stringify({
    type: "error",
    error: { type, message },
  })}\n\n`;
  return new Response(errorSSE, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KIMI_API_KEY = Deno.env.get("KIMI_API_KEY");
    if (!KIMI_API_KEY) {
      return errorResponse(
        500,
        "KIMI_API_KEY is not configured. Add your Moonshot API key to backend secrets to use this integration.",
        "config_error",
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return errorResponse(
        400,
        "Request must include a non-empty 'messages' array.",
        "invalid_request_error",
      );
    }

    const model = body.model || DEFAULT_MODEL;
    const max_tokens = body.max_tokens ?? DEFAULT_MAX_TOKENS;

    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      max_tokens,
    };
    if (typeof body.temperature === "number") {
      payload.temperature = body.temperature;
    }

    const response = await fetch(`${MOONSHOT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KIMI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      let errorMessage = "Kimi API request failed.";
      let errorType = "api_error";

      // Moonshot returns a plain JSON error envelope on failure: { error: { message, type } }
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.message) errorMessage = parsed.error.message;
        if (parsed?.error?.type) errorType = parsed.error.type;
      } catch {
        // Fallback: an SSE-style `data: {...}` error envelope
        const dataMatch = text.match(/data: (.+)/);
        if (dataMatch) {
          try {
            const errorData = JSON.parse(dataMatch[1]);
            if (errorData?.error?.message) errorMessage = errorData.error.message;
            if (errorData?.error?.type) errorType = errorData.error.type;
          } catch {
            /* keep defaults */
          }
        }
      }

      return errorResponse(response.status, errorMessage, errorType);
    }

    // Success: transparently stream the upstream OpenAI-compatible SSE body.
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return errorResponse(
      500,
      error?.message || "Unexpected server error.",
      "server_error",
    );
  }
});
