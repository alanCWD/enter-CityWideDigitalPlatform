const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESET_PROMPTS: Record<string, string> = {
  "Agency Blueprint": `You are CityWide Digital's AI App Architect. Generate a complete agency website app blueprint.

Your output should include:
1. **Site Architecture** — All pages with routes and their purpose
2. **GBP Data Mapping** — How each Google Business Profile field maps to website sections
3. **Feature Modules** — Detailed breakdown of each active feature/module
4. **SEO Strategy** — Schema.org types, meta tags, and structured data plan
5. **Technical Stack** — Recommended components, APIs, and integrations
6. **Content Framework** — Copy structure for each key section
7. **Deployment Checklist** — Step-by-step go-live tasks

Be specific, actionable, and focused on maximizing local search visibility and commission defense.`,

  "GBP Sync Code": `You are CityWide Digital's GBP Integration Architect. Design the complete backend sync system.

Your output should include:
1. **Sync Architecture** — Data flow diagram (GBP → Webhook → Database → Website)
2. **API Endpoints** — All GBP API calls needed (Places, Posts, Reviews, Menus, Products)
3. **Data Models** — Database schema for all synced entities
4. **Webhook Handlers** — Event types and handler logic for real-time updates
5. **Conflict Resolution** — How to handle GBP data conflicts or missing fields
6. **Caching Strategy** — TTL and invalidation rules for synced content
7. **Error Handling** — Retry logic, alerting, and manual override procedures

Focus on zero-downtime sync and data freshness for maximum SEO benefit.`,

  "SEO Master": `You are CityWide Digital's SEO Architect. Perform a complete SEO and AI-readiness overhaul plan.

Your output should include:
1. **Technical SEO Audit** — Core Web Vitals targets, crawlability, indexation
2. **Schema.org Implementation** — All structured data types (LocalBusiness, Menu, Review, Event, Product)
3. **AI Readiness** — llms.txt structure, AI search optimization, voice search targeting
4. **Programmatic SEO** — Dynamic route generation for services × location pages
5. **Internal Linking** — Silo structure and anchor text strategy
6. **Content Calendar** — GBP Post types mapped to website content
7. **Rank Tracking Plan** — KPIs, target keywords, and 3-pack strategy

Every recommendation should directly support Google 3-Pack ranking.`,

  "Programmatic SEO Machine": `You are CityWide Digital's Programmatic SEO Architect. Design a scalable programmatic SEO framework.

Your output should include:
1. **URL Structure** — Dynamic routes: /[service]/[location], /[niche]/near-me
2. **Template System** — Page templates with dynamic content injection
3. **Data Sources** — GBP, Census data, local events for content variation
4. **Schema Injection** — Automated Schema.org markup per page type
5. **Internal Links** — Automated hub-and-spoke link building
6. **Canonical Strategy** — Handling near-duplicate programmatic pages
7. **Indexation Pipeline** — Sitemap generation, Google Search Console integration

Target: 1,000+ indexed pages within 90 days of launch.`,

  "Retail Merchant Sync": `You are CityWide Digital's Retail Commerce Architect. Design the complete retail sync system.

Your output should include:
1. **Product Catalog Sync** — Google Merchant Center → Website product listings
2. **Inventory Management** — Real-time stock levels with low-stock alerts
3. **Local Inventory Ads** — LIA feed structure and Google integration
4. **POS Integration** — Square/Clover/Lightspeed sync for in-store inventory
5. **Product Schema** — Structured data for rich search results
6. **Shopping Cart** — Native checkout vs. Google Buy on Google integration
7. **Analytics** — Conversion tracking, ROAS measurement, attribution

Focus on eliminating marketplace commission fees through first-party commerce.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_5831877fc23c");
    if (!AI_API_TOKEN) {
      throw new Error("AI_API_TOKEN is not configured");
    }

    const { niche, tier, mode, gbp, preset, competitorUrl, customPrompt, clientName } = await req.json();

    // Build context block
    const contextLines: string[] = [
      `You are CityWide Digital's AI App Builder — an expert local business website architect.`,
      ``,
      `## Project Configuration`,
      `- **Client Name**: ${clientName || "New Client"}`,
      `- **Business Niche**: ${niche || "Restaurant"}`,
      `- **Subscription Tier**: ${tier || "Pro"} (${ tier === "basic" ? "$97/mo — GMB Sync + SEO" : tier === "enterprise" ? "$297/mo — Full Suite including Video Reviews, POS, Native Ordering" : "$197/mo — Social Sync, Listing Manager, Analytics"})`,
      `- **Mode**: ${mode === "copy" ? `Clone & Improve Competitor (${competitorUrl || "URL not provided"})` : "Template-based Build"}`,
      `- **Google Business Profile**: ${gbp ? "Connected — full GBP sync enabled" : "Not connected — manual content mode"}`,
    ];

    if (preset && PRESET_PROMPTS[preset]) {
      contextLines.push(`- **Active Preset**: ${preset}`);
    }

    if (customPrompt) {
      contextLines.push(``, `## Additional Instructions`, customPrompt);
    }

    // Determine system prompt
    const presetSystemPrompt = preset && PRESET_PROMPTS[preset] ? PRESET_PROMPTS[preset] : null;

    const systemPrompt = presetSystemPrompt || `You are CityWide Digital's AI App Builder. Generate a detailed, actionable website app specification for the client.

Your output should include:
1. **Executive Summary** — What will be built and why it will rank
2. **Page Architecture** — Complete sitemap with purpose for each page
3. **GBP Integration Plan** — Specific data fields and sync frequency
4. **Feature Activation** — Which tier features to enable and how to configure them
5. **SEO Foundation** — Schema types, target keywords, meta structure
6. **Content Brief** — Key copy points for homepage, services, and GMB posts
7. **Launch Checklist** — Ordered tasks from DNS setup to first GBP post

Keep recommendations specific to the ${niche || "business"} niche and optimize for Google 3-Pack domination.`;

    const userMessage = contextLines.join("\n") + (customPrompt ? "" : `\n\nGenerate the complete app specification for this ${niche || "business"} client.`);

    const response = await fetch("https://api.enter.pro/code/api/v1/ai/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [{ role: "user", content: userMessage }],
        system: systemPrompt,
        stream: true,
        max_tokens: 4096,
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

      const errorSSE = `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { type: errorCode, message: errorMessage },
      })}\n\n`;

      return new Response(errorSSE, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const errorSSE = `event: error\ndata: ${JSON.stringify({
      type: "error",
      error: { type: "api_error", message: error.message },
    })}\n\n`;

    return new Response(errorSSE, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }
});
