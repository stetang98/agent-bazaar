import express from "express";
import cors from "cors";
import { config } from "./config";
import { agentCard, registrationJson } from "./agentCard";
import { ensureRegistered } from "./registry";
import { x402Paywall, type PaidRequest } from "./x402/middleware";
import { auditSolidity } from "./agents/auditor";

async function main(): Promise<void> {
  const identity = await ensureRegistered();
  const agentIdStr = identity.agentId.toString();

  const app = express();
  app.use(cors());
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
    // Validate input BEFORE charging, so a payer never pays for a rejected request.
    (req, res, next) => {
      const source = (req.body as { source?: unknown })?.source;
      if (typeof source !== "string" || source.trim().length === 0) {
        res.status(400).json({ error: "body.source (Solidity source) is required" });
        return;
      }
      next();
    },
    x402Paywall({ agentId: identity.agentId }, { description: "Solidity security audit" }),
    async (req, res) => {
      const { source } = req.body as { source: string };
      const result = await auditSolidity(source);
      const x402 = (req as PaidRequest).x402;
      res.json({
        ...result,
        payment: x402 ? { transaction: x402.transaction, payer: x402.payer } : null,
      });
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
