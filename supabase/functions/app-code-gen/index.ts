const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert React developer building production-ready websites for local businesses.
Given a website blueprint/spec, generate a complete, deployable web app.

CRITICAL: Return ONLY a valid JSON object. No markdown fences, no explanation, no text before or after the JSON.
The JSON object must have file paths as keys and complete file contents as strings as values.

Generate these exact files:
- package.json
- index.html
- vite.config.ts
- tailwind.config.ts
- src/main.tsx
- src/index.css
- src/App.tsx
- src/components/Navbar.tsx
- src/components/Hero.tsx
- src/components/About.tsx
- src/components/Reviews.tsx
- src/components/Contact.tsx
- src/components/Footer.tsx
- Plus 1-2 niche-specific components (e.g. src/components/Menu.tsx for restaurants, src/components/Services.tsx for contractors, src/components/Products.tsx for retail)

TECH STACK (use exactly):
- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3 (via CDN in index.html OR configured via tailwind.config.ts)
- React Router DOM v6 (single page, hash router is fine)
- Lucide React for icons
- No backend, no API calls — static data only

DESIGN RULES:
- Beautiful, modern design with the business's brand colors
- Mobile-first responsive layout
- Real placeholder content that matches the business name and niche
- Smooth CSS transitions and hover effects
- ALL sections must be complete — no TODO comments, no placeholder components

package.json MUST use these exact dependency versions:
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "lucide-react": "^0.462.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.5.3",
    "vite": "^5.4.9"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const aiToken = Deno.env.get("AI_API_TOKEN_5831877fc23c");
    if (!aiToken) {
      const err = `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "api_error", message: "AI token not configured" } })}\n\n`;
      return new Response(err, { status: 500, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    const { blueprint, niche, tier, clientName, template } = await req.json();

    if (!blueprint) {
      const err = `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "blueprint is required" } })}\n\n`;
      return new Response(err, { status: 400, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    const userPrompt = `Generate a complete website for:
Business Name: ${clientName || "My Business"}
Niche: ${niche || "Restaurant"}
Template Type: ${template || "restaurant"}
Tier: ${tier || "pro"}

APP BLUEPRINT:
${blueprint}

Return ONLY the JSON object with all files. The business name is "${clientName}" — use it throughout the code.`;

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiToken}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        max_tokens: 16000,
        stream: true,
        messages: [{ role: "user", content: userPrompt }],
        system: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = "AI service error";
      let errorCode = "api_error";
      const dataMatch = text.match(/data: (.+)/);
      if (dataMatch) {
        try {
          const errorData = JSON.parse(dataMatch[1]);
          errorMessage = errorData.error?.message || errorMessage;
          errorCode = errorData.error?.type || errorCode;
        } catch { /* use defaults */ }
      }
      const errorSSE = `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: errorCode, message: errorMessage } })}\n\n`;
      return new Response(errorSSE, { status: response.status, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Pipe SSE stream directly to frontend
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const errorSSE = `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "api_error", message: error.message } })}\n\n`;
    return new Response(errorSSE, { status: 500, headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  }
});
