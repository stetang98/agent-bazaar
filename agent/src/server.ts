import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { config } from "./config";
import { agentCard, registrationJson } from "./agentCard";
import { ensureRegistered } from "./registry";
import { x402Paywall } from "./x402/middleware";
import { auditSolidity } from "./agents/auditor";

const MAX_SOURCE_CHARS = 50_000; // ~1250 lines — well above any real contract, below the model's context

// Minimal in-memory IP rate limiter (no external dep) for the unauthenticated audit path.
function rateLimit(maxPerWindow: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= maxPerWindow) {
      res.status(429).json({ error: "rate limit exceeded — slow down" });
      return;
    } else {
      entry.count++;
    }
    next();
  };
}

async function main(): Promise<void> {
  const identity = await ensureRegistered();
  const agentIdStr = identity.agentId.toString();

  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(cors({ origin: config.ALLOWED_ORIGIN.split(",").map((o) => o.trim()), methods: ["GET", "POST"] }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, agentId: agentIdStr, engine: config.hasOpenAI ? "openai" : "static-analyzer" });
  });
  app.get("/.well-known/agent-card.json", (_req, res) => {
    res.json(agentCard(agentIdStr));
  });
  app.get("/.well-known/agent-registration.json", (_req, res) => {
    res.json(registrationJson(agentIdStr));
  });

  app.post(
    "/agents/auditor/audit",
    rateLimit(15, 60_000),
    // Validate input BEFORE charging, so a payer never pays for a rejected request.
    (req, res, next) => {
      const source = (req.body as { source?: unknown })?.source;
      if (typeof source !== "string" || source.trim().length === 0) {
        res.status(400).json({ error: "body.source (Solidity source) is required" });
        return;
      }
      if (source.length > MAX_SOURCE_CHARS) {
        res.status(413).json({ error: `source exceeds the ${MAX_SOURCE_CHARS}-character limit` });
        return;
      }
      next();
    },
    x402Paywall({ agentId: identity.agentId }, { description: "Solidity security audit" }),
    async (req, res) => {
      try {
        const { source } = req.body as { source: string };
        const result = await auditSolidity(source);
        res.json({
          ...result,
          payment: req.x402 ? { transaction: req.x402.transaction, payer: req.x402.payer } : null,
        });
      } catch (err) {
        console.error("[audit] handler error:", err);
        res.status(500).json({ error: "audit failed" });
      }
    },
  );

  app.listen(config.PORT, () => {
    console.log(`🛰️  Agent Bazaar auditor on http://localhost:${config.PORT} (agent #${agentIdStr})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
