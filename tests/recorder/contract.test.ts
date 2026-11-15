/**
 * Contract tests for the CWD -> Customer Content Studio mapping and push service.
 *
 * The mock intake behaves like the recorder: companies and locations are
 * matched by stable ids (so repeats update, never duplicate), omitted fields are
 * preserved, and each accepted request returns links and a QR address.
 *
 * Run: node --experimental-strip-types --test tests/recorder/contract.test.ts
 */

import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";

import { buildRecorderCompany, validateRecorderCompany } from "../../supabase/functions/recorder-sync/lib/payload.ts";
import { pushRecorderCompany } from "../../supabase/functions/recorder-sync/lib/push.ts";
import type { CompanyBundle, RecorderCompanyPayload, RecorderScene } from "../../supabase/functions/recorder-sync/lib/types.ts";

interface MockCompany {
  id: string;
  name: string;
  trade: string;
  brand_color: string;
  is_network: boolean;
  watermark_url?: string;
  watermark_text?: string;
  watermark_handle?: string;
  credit_line?: string;
  default_hashtags?: string;
  phone?: string;
  logo_url?: string;
  locations: Map<string, MockLocation>;
}

interface MockLocation {
  id: string;
  name: string;
  slug: string;
  headline?: string;
  phone?: string;
  logo_url?: string;
  campaign_count: number;
  campaigns: Map<string, { id: string; format: string; scenes: RecorderScene[] }>;
}

const companies = new Map<string, MockCompany>();
const requests: Array<{ key: string | undefined; body: { company: RecorderCompanyPayload } }> = [];
let flakyCount = 0;
let server: ReturnType<typeof createServer>;
let baseUrl = "";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "location";
}

function accept(payload: RecorderCompanyPayload) {
  const company = payload as unknown as MockCompany & { location: Record<string, unknown>; campaigns: RecorderCompanyPayload["campaigns"] };
  let record = companies.get(String(payload.id));
  if (!record) {
    record = {
      id: String(payload.id),
      name: "",
      trade: "general",
      brand_color: "#000000",
      is_network: false,
      locations: new Map(),
    };
    companies.set(String(payload.id), record);
  }
  const copy = { ...(payload as unknown as Record<string, unknown>) };
  delete copy.location;
  delete copy.campaigns;
  for (const [key, value] of Object.entries(copy)) {
    if (value !== undefined) (record as unknown as Record<string, unknown>)[key] = value;
  }

  const rawLocation = payload.location as unknown as Record<string, unknown>;
  let location = record.locations.get(String(rawLocation.id));
  if (!location) {
    location = {
      id: String(rawLocation.id),
      name: "",
      slug: slugify(String(rawLocation.name ?? "location")),
      campaign_count: 0,
      campaigns: new Map(),
    };
    record.locations.set(String(rawLocation.id), location);
  }
  for (const [key, value] of Object.entries(rawLocation)) {
    if (value !== undefined) (location as unknown as Record<string, unknown>)[key] = value;
  }

  for (const campaign of payload.campaigns) {
    const sceneList = campaign.scenes.map((s, i) => ({ ...s, position: i + 1, id: `${campaign.id}-${i}` }));
    location.campaigns.set(campaign.id, { id: campaign.id, format: campaign.format, scenes: sceneList });
  }
  location.campaign_count = location.campaigns.size;
  return { company: record, location };
}

async function readBody(req: IncomingMessage): Promise<{ company: RecorderCompanyPayload }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST" || !["/intake", "/flaky"].includes(req.url ?? "")) {
    res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (req.url === "/flaky") {
    flakyCount += 1;
    if (flakyCount <= 2) {
      res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "temporary" }));
      return;
    }
  }

  const key = req.headers["x-cwd-key"];
  if (key !== "good-key") {
    res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Invalid intake key" }));
    return;
  }

  const body = await readBody(req);
  requests.push({ key: typeof key === "string" ? key : undefined, body });
  if (!body?.company?.id) {
    res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "company.id is required" }));
    return;
  }
  if (!body.company.name) {
    res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "company.name is required" }));
    return;
  }

  const { company, location } = accept(body.company);
  const campaignCode = body.company.campaigns[0]?.id?.slice(0, 8) ?? null;
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
    ok: true,
    companyId: company.id,
    companyName: company.name,
    locationId: location.id,
    locationSlug: location.slug,
    campaignCode,
    campaigns: body.company.campaigns.length,
    links: {
      path: `/l/${location.slug}`,
      url: `https://recorder.test/l/${location.slug}`,
      qr: `https://recorder.test/qr/${location.slug}.png`,
      embedPath: `/embed/${location.slug}`,
    },
  }));
}

function baseCompany(overrides: Partial<CompanyBundle["company"]> = {}): CompanyBundle["company"] {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    stable_id: "cwd-client-1",
    crm_client_id: "cwd-client-1",
    agency_id: "citywide",
    name: "Harbour Table",
    trade: "restaurant",
    website: "https://harbourtable.test",
    phone: "+1 250 555 0100",
    city: "Victoria",
    logo_url: null,
    brand_color: "#0B6E4F",
    is_network: false,
    watermark_url: null,
    watermark_text: null,
    watermark_handle: null,
    credit_line: null,
    default_hashtags: null,
    enabled: true,
    ...overrides,
  };
}

function baseLocation(overrides: Partial<CompanyBundle["location"]> = {}): CompanyBundle["location"] {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    company_id: "11111111-1111-4111-8111-111111111111",
    agency_id: "citywide",
    name: "Harbour Table",
    address: "12 Wharf St",
    neighbourhood: "Inner Harbour",
    website: "https://harbourtable.test",
    phone: "+1 250 555 0100",
    logo_url: null,
    brand_color: "#0B6E4F",
    headline: "Waterfront dining",
    enable_video: true,
    enable_photos: true,
    enable_wall: true,
    active: true,
    location_slug: null,
    customer_url: null,
    qr_url: null,
    embed_path: null,
    campaign_code: null,
    campaigns_sent: null,
    last_synced_at: null,
    last_sync_status: null,
    last_sync_error: null,
    ...overrides,
  };
}

function scenes(kind: "review" | "promo" = "review"): RecorderScene[] {
  const base = [
    { key: "welcome", label: "Welcome", prompt: "Say hello.", hint: "Smile", capture: "video" as const },
    { key: "concept", label: "The concept", prompt: "Explain the concept.", hint: "Show the room", capture: "video" as const },
    { key: "dish", label: "The dish", prompt: "Show the dish.", hint: "Three angles", capture: "photos" as const },
  ];
  return base.map((s, i) => ({
    ...s,
    id: `scene-${i}`,
    campaign_id: kind === "promo" ? "campaign-promo" : "campaign-review",
    position: i + 1,
  }));
}

function reviewCampaign() {
  return [{
    campaign: {
      id: "campaign-review",
      location_id: "22222222-2222-4222-8222-222222222222",
      label: "Customer review",
      headline: "Tell us about your visit",
      format: "review" as const,
      due_at: "2026-12-01",
      dish_name: null,
      concept: null,
      enable_video: true,
      enable_photos: true,
      active: true,
      recorder_code: null,
    },
    scenes: scenes("review"),
  }];
}

function restaurantBundle(overrides: Partial<CompanyBundle["company"]> = {}, locationOverrides: Partial<CompanyBundle["location"]> = {}): CompanyBundle {
  const company = baseCompany(overrides);
  return {
    company,
    location: baseLocation({ ...locationOverrides, company_id: company.id }),
    campaigns: reviewCampaign(),
    branding: { logo_url: "https://cdn.citywide.test/brand/harbour-table.png", tagline: "Waterfront dining" },
  };
}

function promoBundle(): CompanyBundle {
  const company = baseCompany({
    id: "99999999-9999-4999-8999-999999999999",
    stable_id: "net_vfs01",
    crm_client_id: null,
    name: "Victoria Food Scene",
    trade: "restaurant",
    brand_color: "#E11D48",
    is_network: true,
    logo_url: "https://cdn.citywide.test/brand/vfs-network.png",
    watermark_url: "https://cdn.citywide.test/brand/vfs-watermark.png",
    watermark_text: "Victoria Food Scene",
    watermark_handle: "@victoriafoodscene",
    credit_line: "Filmed for Victoria Food Scene",
    default_hashtags: "#victoriafoodscene #yyj",
    website: null,
    phone: null,
    city: "Victoria",
  });
  const location = baseLocation({
    id: "33333333-3333-4333-8333-333333333333",
    company_id: company.id,
    name: "Casa Nova",
    logo_url: "https://cdn.citywide.test/brand/casa-nova.png",
    brand_color: "#F97316",
    headline: "Coastal Italian",
  });
  return {
    company,
    location,
    branding: {},
    campaigns: [{
      campaign: {
        id: "campaign-promo",
        location_id: location.id,
        label: "VFS launch promo",
        headline: "Meet Casa Nova",
        format: "promo",
        due_at: "2026-12-20",
        dish_name: "Cacio e pepe",
        concept: "A coastal Italian dinner spot in Victoria.",
        enable_video: true,
        enable_photos: false,
        active: true,
        recorder_code: null,
      },
      scenes: scenes("promo"),
    }],
  };
}

before(async () => {
  server = createServer((req, res) => { handler(req, res).catch(() => res.writeHead(500).end()); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (typeof address === "object" && address) baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  companies.clear();
  requests.length = 0;
  flakyCount = 0;
});

const config = () => ({ intakeUrl: `${baseUrl}/intake`, intakeKey: "good-key" });
const options = { sleep: async () => {} };

describe("recorder intake contract", () => {
  it("pushes a restaurant with a working customer link and QR", async () => {
    const payload = buildRecorderCompany(restaurantBundle());
    assert.deepEqual(validateRecorderCompany(payload), []);

    const result = await pushRecorderCompany(payload, config(), options);
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.equal(result.body?.links?.path?.startsWith("/l/"), true);
    assert.equal(result.body?.links?.url, `https://recorder.test/l/${result.body?.locationSlug}`);
    assert.equal(result.body?.links?.qr?.endsWith(".png"), true);
    assert.equal(result.body?.campaigns, 1);

    const sent = requests[0].body.company;
    assert.equal(sent.id, "cwd-client-1");
    assert.equal(sent.location.id, payload.location.id);
    assert.equal(sent.campaigns.length, 1);
    assert.equal(sent.campaigns[0].scenes.length, 3);
    assert.equal(sent.is_network, false);
    assert.equal("watermark_url" in sent, false);
  });

  it("updates on a repeat push and never duplicates the company", async () => {
    const first = await pushRecorderCompany(buildRecorderCompany(restaurantBundle()), config(), options);
    assert.equal(first.ok, true);
    const slug = first.body?.locationSlug;

    const changed = restaurantBundle({}, { headline: "New autumn menu" });
    const second = await pushRecorderCompany(buildRecorderCompany(changed), config(), options);
    assert.equal(second.ok, true);
    assert.equal(second.body?.locationSlug, slug);
    assert.equal(companies.size, 1);
    assert.equal(companies.get("cwd-client-1")?.locations.size, 1);
    assert.equal(companies.get("cwd-client-1")?.locations.get(changed.location.id)?.headline, "New autumn menu");
  });

  it("does not clear omitted fields on a partial update", async () => {
    const full = restaurantBundle();
    await pushRecorderCompany(buildRecorderCompany(full), config(), options);

    const partial: CompanyBundle = {
      ...full,
      company: { ...full.company, phone: null, website: null, logo_url: null },
      location: { ...full.location, phone: null, logo_url: null, headline: null },
      branding: {},
    };
    const mapperPayload = buildRecorderCompany(partial);
    assert.equal("phone" in mapperPayload, false);
    assert.equal("website" in mapperPayload, false);
    assert.equal("logo_url" in mapperPayload, false);
    assert.equal("headline" in mapperPayload.location, false);

    const result = await pushRecorderCompany(mapperPayload, config(), options);
    assert.equal(result.ok, true);
    const storedLocation = companies.get("cwd-client-1")?.locations.get(full.location.id);
    assert.equal(storedLocation?.phone, "+1 250 555 0100");
    assert.equal(storedLocation?.headline, "Waterfront dining");
    // The first push fell back to the single business's brand-asset logo; a
    // later push that omits the logo must not clear it.
    assert.equal(storedLocation?.logo_url, "https://cdn.citywide.test/brand/harbour-table.png");
  });

  it("maps a Victoria Food Scene promo with photo dish scene and brand kit", async () => {
    const bundle = promoBundle();
    const payload = buildRecorderCompany(bundle);
    assert.deepEqual(validateRecorderCompany(payload), []);
    assert.equal(payload.is_network, true);
    assert.equal(payload.watermark_handle, "@victoriafoodscene");
    assert.equal(payload.campaigns[0].format, "promo");
    assert.equal(payload.campaigns[0].enable_video, true);
    assert.equal(payload.campaigns[0].enable_photos, false);
    assert.equal(payload.campaigns[0].dish_name, "Cacio e pepe");
    assert.equal(payload.campaigns[0].scenes.length, 3);
    assert.equal(payload.campaigns[0].scenes[2].capture, "photos");
    assert.equal(payload.logo_url, bundle.company.logo_url);
    assert.equal(payload.location.logo_url, bundle.location.logo_url);

    const result = await pushRecorderCompany(payload, config(), options);
    assert.equal(result.ok, true);
    assert.equal(result.body?.companyId, "net_vfs01");
  });

  it("keeps two restaurants under one network company id", async () => {
    const bundle = promoBundle();
    const first = buildRecorderCompany(bundle);
    const secondBundle: CompanyBundle = {
      ...bundle,
      location: { ...bundle.location, id: "44444444-4444-4444-8444-444444444444", name: "Blue Heron Kitchen" },
    };
    const second = buildRecorderCompany(secondBundle);

    await pushRecorderCompany(first, config(), options);
    const result = await pushRecorderCompany(second, config(), options);
    assert.equal(result.ok, true);
    assert.equal(companies.size, 1);
    assert.equal(companies.get("net_vfs01")?.locations.size, 2);
    assert.notEqual(first.location.id, second.location.id);
  });

  it("pushes a company with no campaign", async () => {
    const bundle = restaurantBundle();
    bundle.campaigns = [];
    const payload = buildRecorderCompany(bundle);
    assert.deepEqual(payload.campaigns, []);
    assert.deepEqual(validateRecorderCompany(payload), []);

    const result = await pushRecorderCompany(payload, config(), options);
    assert.equal(result.ok, true);
    assert.equal(result.body?.campaigns, 0);
    assert.equal(result.body?.campaignCode, null);
  });

  it("rejects a missing company id or name before sending", async () => {
    const payload = buildRecorderCompany(restaurantBundle({ name: "" }));
    const issues = validateRecorderCompany(payload);
    assert.equal(issues.some((i) => i.field === "company.name"), true);

    const result = await pushRecorderCompany(payload, config(), options);
    assert.equal(result.ok, false);
    assert.equal(result.permanent, true);
    assert.equal(requests.length, 0);

    const noId = { ...buildRecorderCompany(restaurantBundle()), id: "" };
    const idResult = await pushRecorderCompany(noId, config(), options);
    assert.equal(idResult.ok, false);
    assert.equal(idResult.permanent, true);
    assert.equal(requests.length, 0);
  });

  it("returns 401 for a wrong intake key without retrying", async () => {
    const payload = buildRecorderCompany(restaurantBundle());
    const result = await pushRecorderCompany(payload, { ...config(), intakeKey: "wrong-key" }, options);
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.permanent, true);
    assert.equal(result.attempts, 1);
    assert.match(result.error ?? "", /Invalid intake key/);
    assert.equal(companies.size, 0);
  });

  it("refuses to send without an intake key", async () => {
    const payload = buildRecorderCompany(restaurantBundle());
    const result = await pushRecorderCompany(payload, { intakeUrl: config().intakeUrl, intakeKey: "" }, options);
    assert.equal(result.ok, false);
    assert.equal(result.permanent, true);
    assert.equal(requests.length, 0);
  });

  it("retries temporary recorder failures with backoff", async () => {
    const payload = buildRecorderCompany(restaurantBundle());
    const result = await pushRecorderCompany(
      payload,
      { intakeUrl: `${baseUrl}/flaky`, intakeKey: "good-key" },
      { ...options, maxAttempts: 3 },
    );
    assert.equal(result.ok, true);
    assert.equal(result.attempts, 3);
    assert.equal(flakyCount, 3);
  });

  it("rejects oversized payloads without sending", async () => {
    const bundle = promoBundle();
    bundle.company.watermark_text = "x".repeat(410 * 1024);
    const result = await pushRecorderCompany(buildRecorderCompany(bundle), config(), options);
    assert.equal(result.ok, false);
    assert.equal(result.permanent, true);
    assert.match(result.error ?? "", /400 KB/);
    assert.equal(requests.length, 0);
  });
});
