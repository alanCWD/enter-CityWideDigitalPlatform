const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert React developer building production-ready websites for local businesses.
Given a website blueprint/spec, generate a complete, deployable web app.

OUTPUT FORMAT — CRITICAL:
Return each file using this EXACT delimiter format. No JSON, no markdown fences, no explanation.

===FILE:path/to/file.ext===
<file contents here, exactly as they should appear in the file>
===END===

Repeat for every file. The first line of every file block must be "===FILE:<path>===" and end with "===END===" on its own line.

Generate these exact files:
- package.json
- index.html
- vite.config.ts
- tailwind.config.ts
- tsconfig.json
- postcss.config.js
- src/main.tsx
- src/index.css
- src/App.tsx
- src/components/Navbar.tsx
- src/components/Hero.tsx
- src/components/About.tsx
- src/components/Reviews.tsx
- src/components/Contact.tsx
- src/components/Footer.tsx
- 1-2 niche-specific components (Menu.tsx for restaurants, Services.tsx for contractors, Products.tsx for retail)

TECH STACK:
- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- React Router DOM v6 (HashRouter is fine)
- Lucide React for icons
- No backend, static data only

DESIGN RULES:
- Beautiful, modern, mobile-first responsive design
- Real placeholder content matching the business name and niche
- Smooth transitions and hover states
- ALL components fully implemented — no TODO comments

package.json must use these exact versions:
{
  "name": "<slugified-business-name>",
  "private": true,
  "version": "0.1.0",
  "type": "module",
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
}

EXAMPLE OUTPUT FORMAT:
===FILE:package.json===
{
  "name": "example",
  "version": "0.1.0"
}
===END===
===FILE:src/App.tsx===
import React from 'react';
export default function App() {
  return <div>Hello</div>;
}
===END===`;

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

Use the delimiter format. Business name "${clientName}" must appear throughout the code.`;

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiToken}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        max_tokens: 32000,
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
