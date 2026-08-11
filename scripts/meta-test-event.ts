/**
 * Post a synthetic event to the Meta Conversions API and print exactly what Meta says back.
 *
 * This is the fastest way to prove the access token, pixel id, Graph version and payload shape
 * are all correct — before a single line of UI is wired. It reads nothing from the database and
 * writes nothing anywhere.
 *
 * Run: npm run meta:test
 *      npm run meta:test -- --code TEST12345     (route it to Test Events in Events Manager)
 *
 * Get the test code from Events Manager → your pixel → Test Events → the string shown at the top.
 * Without it the event goes into your REAL stream, which is fine but shows up in reporting.
 */
import process from "node:process";
try {
  process.loadEnvFile(".env.local");
} catch {}
try {
  process.loadEnvFile(".env");
} catch {}

import { createHash } from "node:crypto";

const PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
const TOKEN = (process.env.META_CAPI_ACCESS_TOKEN ?? "").trim();
const GRAPH = "v21.0";

const argCode = (() => {
  const i = process.argv.indexOf("--code");
  return i > -1 ? process.argv[i + 1] : undefined;
})();
const TEST_CODE = argCode ?? (process.env.META_CAPI_TEST_EVENT_CODE ?? "").trim();

function fail(msg: string): never {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

if (!PIXEL_ID) fail("NEXT_PUBLIC_META_PIXEL_ID is not set in .env.local");
if (!TOKEN) {
  fail(
    "META_CAPI_ACCESS_TOKEN is not set in .env.local.\n" +
      "  Generate it: Events Manager → Data Sources → your pixel → Settings →\n" +
      "  Conversions API → Generate access token. It starts with 'EAA'.",
  );
}

const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

const body = {
  data: [
    {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      // A fixed id so re-running this never inflates anything: Meta dedups it against itself.
      event_id: "meta-test-event-fixed-id",
      action_source: "website",
      // Localhost rather than a guessed production domain: this is a test event, and a wrong
      // source URL is worse than an obviously-local one when reading it back in Events Manager.
      event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/`,
      user_data: {
        em: sha256("test@example.com"),
        ph: sha256("97433445566"),
        client_ip_address: "203.0.113.1",
        client_user_agent: "Mozilla/5.0 (meta-test-event script)",
      },
      custom_data: {
        content_type: "product",
        content_ids: ["meta-test-handle"],
        contents: [{ id: "meta-test-handle", quantity: 1, item_price: 1.0 }],
        value: 1.0,
        currency: "QAR",
        num_items: 1,
      },
    },
  ],
  ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
};

const url = `https://graph.facebook.com/${GRAPH}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`;

console.log(`\n  pixel      ${PIXEL_ID}`);
console.log(`  graph      ${GRAPH}`);
console.log(`  test code  ${TEST_CODE || "(none — this lands in your REAL event stream)"}`);
console.log(`  token      ${TOKEN.slice(0, 6)}…${TOKEN.slice(-4)} (${TOKEN.length} chars)\n`);

const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();

if (!res.ok) {
  console.error(`  HTTP ${res.status}\n  ${text}\n`);
  if (text.includes("Invalid OAuth")) console.error("  → the access token is wrong, expired, or belongs to another pixel.\n");
  if (text.includes("Unsupported post request")) console.error("  → the pixel id is wrong, or the token has no access to it.\n");
  process.exit(1);
}

const json = JSON.parse(text) as { events_received?: number; messages?: unknown[]; fbtrace_id?: string };
console.log(`  HTTP ${res.status}`);
console.log(`  events_received  ${json.events_received}`);
console.log(`  messages         ${JSON.stringify(json.messages ?? [])}`);
console.log(`  fbtrace_id       ${json.fbtrace_id}`);
console.log(
  json.events_received === 1
    ? `\n  Working. ${TEST_CODE ? "Check Events Manager → Test Events — it should appear within seconds." : "Check Events Manager → your pixel → Overview."}\n`
    : `\n  Meta accepted the request but reported ${json.events_received} events — check the messages above.\n`,
);
