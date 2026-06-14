// Hands-free demo recorder for Agent Bazaar.
//
// Drives the live dApp through the full discover -> pay (x402/EIP-3009) -> audit
// -> rate (ERC-8004) flow with no human input, and records a video paced to the
// English narration. The wallet is the in-app demo provider (web/src/lib/
// demoWallet.ts): we inject the testnet key at runtime via window.__DEMO_PK__ so
// signing is silent (no extension popups) — everything that hits chain is real.
//
// Usage:  node record-demo.mjs            (reads key from ../../agent/.env)
//         DEMO_URL=http://localhost:5173 node record-demo.mjs
//
// Prereqs: dev frontend (:5173) + agent backend (:8787) running;
//          narration already generated (scripts/make-demo.sh narration).
import { chromium } from "playwright";
import { readFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..", "..");
const OUT = join(process.env.HOME, "Desktop", "agent-bazaar-demo");
const URL = process.env.DEMO_URL || "http://localhost:5173";
const W = 1440;
const H = 900;

// --- load testnet key from gitignored .env files (never hardcoded) -----------
function parseEnv(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}
const env = { ...parseEnv(join(ROOT, "agent", ".env")), ...parseEnv(join(ROOT, "web", ".env")) };
// Use a strictly testnet-only key. Project-specific names only — no generic
// PRIVATE_KEY fallback, so this can never pick up a real key from a shared .env.
const PK = process.env.DEMO_PK || env.DEMO_PK || env.AGENT_PK || env.FACILITATOR_PK || "";
const RPC = process.env.DEMO_RPC || env.VITE_RPC_URL || env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const PK0x = PK.startsWith("0x") ? PK : `0x${PK}`;
if (!/^0x[0-9a-fA-F]{64}$/.test(PK0x)) {
  console.error("✗ No valid testnet key found (set DEMO_PK or FACILITATOR_PK in agent/.env)");
  process.exit(1);
}

// --- beat start times: parse the generated SRT so we always match the audio ---
function loadBeats() {
  try {
    const srt = readFileSync(join(OUT, "demo.srt"), "utf8");
    const starts = [];
    for (const m of srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d)\s*-->/g)) {
      starts.push(+m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000);
    }
    return starts;
  } catch {
    return [];
  }
}
const beats = loadBeats();
const beat = (i, fallback) => (Number.isFinite(beats[i]) ? beats[i] : fallback);
const END = beat(8, 119) + 13; // hold past the final line, then stop

const log = (msg) => console.log(`[rec ${(elapsed()).toFixed(1)}s] ${msg}`);
let t0 = 0;
const elapsed = () => (t0 ? (Date.now() - t0) / 1000 : 0);
const until = async (page, t) => {
  const ms = (t - elapsed()) * 1000;
  if (ms > 0) await page.waitForTimeout(ms);
};
const soft = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    log(`(skip ${label}: ${e.message.split("\n")[0]})`);
  }
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: W, height: H } },
});
await ctx.addInitScript(
  ([pk, rpc]) => {
    window.__DEMO_PK__ = pk;
    window.__DEMO_RPC__ = rpc;
  },
  [PK0x, RPC],
);

const page = await ctx.newPage();
const video = page.video();
let ok = true;
try {
  t0 = Date.now();
  log(`recording -> ${URL}  (beats: ${beats.map((b) => b.toFixed(0)).join(",") || "default"})`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 20000 });

  // beats 1-2: home / pitch. Connect the wallet early so the detail flow is ready.
  await until(page, 4);
  log("connect wallet");
  await page.getByRole("button", { name: "Connect Wallet" }).click({ timeout: 20000 });
  await page.getByRole("button", { name: /Disconnect wallet/ }).waitFor({ timeout: 20000 });

  // beat 3: open the auditor.
  await until(page, beat(2, 29));
  log("open agent");
  await page.getByRole("button", { name: /Hire agent/ }).first().click({ timeout: 20000 });
  await page.getByRole("button", { name: /pay \$0\.10/ }).waitFor({ timeout: 30000 });

  // beat 4: pay + audit (gasless signature -> on-chain settlement).
  await until(page, beat(3, 43));
  log("audit · pay $0.10 USDC");
  await page.getByRole("button", { name: /pay \$0\.10/ }).click({ timeout: 30000 });

  // beats 5-6: wait for the real result + settlement link.
  log("awaiting settlement + audit result…");
  await page.locator(".result").waitFor({ timeout: 120000 });
  log("result in");
  await until(page, beat(5, 70));
  await soft("hover payment link", async () => {
    const pay = page.locator(".result__bar a");
    if (await pay.count()) await pay.first().hover();
  });

  // beat 7: rate on-chain + filter to verified buyers.
  await until(page, beat(6, 80));
  log("rate 5 stars (on-chain giveFeedback)");
  await page.getByRole("button", { name: "5 stars" }).click({ timeout: 20000 });
  await page.waitForTimeout(3500);
  await soft("verified-buyers toggle", async () => {
    const cb = page.locator(".toggle input[type='checkbox']");
    if (await cb.count()) await cb.first().check();
  });

  // beat 8-9: rest on reputation + close.
  await until(page, beat(7, 98));
  await soft("show reputation", async () => {
    await page.locator(".detail__side").scrollIntoViewIfNeeded();
  });
  await until(page, END);
  log("done");
} catch (e) {
  ok = false;
  console.error(`✗ recording failed: ${e.message}`);
} finally {
  await ctx.close();
  await browser.close();
}

if (video) {
  const src = await video.path();
  const dest = join(OUT, "demo-raw.webm");
  copyFileSync(src, dest);
  console.log(`\n${ok ? "✓" : "⚠"} raw video: ${dest}`);
  if (ok) console.log(`  next: bash scripts/make-demo.sh mux "${dest}"`);
}
process.exit(ok ? 0 : 1);
