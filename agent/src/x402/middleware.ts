import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { buildRequirements, build402 } from "./challenge";
import { verifyPayment } from "./verify";
import { settlePayment } from "./settle";
import { getUsdcDomain } from "./usdcDomain";
import type { PaymentPayload } from "./types";

const addr = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const uintStr = z.string().regex(/^\d+$/);
const bytes32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const hex = z.string().regex(/^0x[a-fA-F0-9]+$/);

const PaymentPayloadSchema = z.object({
  x402Version: z.number(),
  scheme: z.literal("exact"),
  network: z.string(),
  payload: z.object({
    signature: hex,
    authorization: z.object({
      from: addr,
      to: addr,
      value: uintStr,
      validAfter: uintStr,
      validBefore: uintStr,
      nonce: bytes32,
    }),
  }),
});

export interface PaywallContext {
  agentId: bigint;
}

// Guards two concurrent requests from racing the same authorization into a double settle.
const pendingNonces = new Set<string>();

/**
 * Express middleware implementing the x402 server side: 402 + requirements when no X-PAYMENT
 * header; otherwise validate + verify the signed authorization, settle on-chain via PaymentEscrow,
 * attach X-PAYMENT-RESPONSE, and continue. Malformed payloads → 400; infra failures → 500 (generic).
 */
export function x402Paywall(ctx: PaywallContext, opts: { description: string }) {
  return async function paywall(req: Request, res: Response, next: NextFunction): Promise<void> {
    let domain: { name: string; version: string };
    try {
      domain = await getUsdcDomain();
    } catch {
      res.status(503).json({ error: "payment temporarily unavailable" });
      return;
    }

    const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
    const requirements = buildRequirements({ resource, description: opts.description, domain });

    const header = req.header("X-PAYMENT");
    if (!header) {
      res.status(402).json(build402(requirements));
      return;
    }

    let payload: PaymentPayload;
    try {
      const decoded: unknown = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      // Regex-validated above, so the cast to the branded 0x string types is sound.
      payload = PaymentPayloadSchema.parse(decoded) as unknown as PaymentPayload;
    } catch {
      res.status(400).json({ error: "malformed X-PAYMENT header" });
      return;
    }

    const nonce = payload.payload.authorization.nonce;
    if (pendingNonces.has(nonce)) {
      res.status(409).json({ error: "this payment authorization is already being processed" });
      return;
    }
    pendingNonces.add(nonce);
    try {
      const verdict = await verifyPayment(payload, requirements, domain);
      if (!verdict.isValid) {
        res.status(402).json({ ...build402(requirements), error: verdict.reason ?? "payment invalid" });
        return;
      }
      const result = await settlePayment(payload, ctx.agentId);
      res.setHeader(
        "X-PAYMENT-RESPONSE",
        Buffer.from(
          JSON.stringify({
            success: true,
            transaction: result.transaction,
            network: requirements.network,
            payer: result.payer,
          }),
        ).toString("base64"),
      );
      req.x402 = result;
      next();
    } catch (err) {
      console.error("[x402] settlement error:", err);
      res.status(500).json({ error: "payment settlement failed" });
    } finally {
      pendingNonces.delete(nonce);
    }
  };
}
