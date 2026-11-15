#!/usr/bin/env node
/**
 * The Enter deployer bundles one file per backend function, so the Content
 * Studio modules under supabase/functions/recorder-sync/lib are concatenated
 * into the deployable index.ts. Edit the modules (or main.ts / pull.ts), then:
 *
 *   node scripts/bundle-recorder-function.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "supabase/functions/recorder-sync");

const order = [
  "lib/types.ts",
  "lib/payload.ts",
  "lib/push.ts",
  "lib/crm.ts",
  "lib/store.ts",
  "lib/pull-auth.ts",
  "pull.ts",
  "main.ts",
];

const header = `// AUTO-GENERATED — do not edit directly.
// Source: supabase/functions/recorder-sync/{main.ts,pull.ts,lib/*.ts}
// Regenerate with: node scripts/bundle-recorder-function.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
`;

const parts = [header];
for (const relative of order) {
  let source = await readFile(join(dir, relative), "utf8");
  const withoutImports = source.replace(/^import[\s\S]*?;\s*$/gm, "");
  const local = withoutImports.replace(/^export\s+(async\s+function|function|interface|type|const|class)\s/gm, "$1 ");
  parts.push(`\n// ── ${relative} ${"─".repeat(Math.max(4, 60 - relative.length))}\n${local.trim()}\n`);
}

const output = parts.join("\n");
const body = parts.slice(1).join("\n");
const leftovers = body.split("\n").filter((line) => /^\s*(import|export)\s/.test(line));
if (leftovers.length > 0) {
  console.error("Unexpected module syntax left in the bundle:", leftovers.slice(0, 10));
  process.exit(1);
}

await writeFile(join(dir, "index.ts"), output, "utf8");
console.log(`Bundled ${order.length} files into supabase/functions/recorder-sync/index.ts (${output.split("\n").length} lines).`);
