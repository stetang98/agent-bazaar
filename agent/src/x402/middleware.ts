import type { Request, Response, NextFunction } from "express";
import { buildRequirements, build402 } from "./challenge";
import { verifyPayment } from "./verify";
import { settlePayment, type SettleResult } from "./settle";
import { getUsdcDomain } from "./usdcDomain";
import type { PaymentPayload } from "./types";

export interface PaywallContext {
  agentId: bigint;
}

export type PaidRequest = Request & { x402?: SettleResult };

/**
 * Express middleware implementing the x402 server side: respond 402 with payment requirements
 * when no X-PAYMENT header is present; otherwise verify the signed authorization, settle it
 * on-chain through PaymentEscrow, attach X-PAYMENT-RESPONSE, and continue to the handler.
 */
export function x402Paywall(ctx: PaywallContext, opts: { description: string }) {
  return async function paywall(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const domain = await getUsdcDomain();
      const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const requirements = buildRequirements({ resource, description: opts.description, domain });

      const header = req.header("X-PAYMENT");
      if (!header) {
        res.status(402).json(build402(requirements));
        return;
      }

      let payload: PaymentPayload;
      try {
        payload = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as PaymentPayload;
      } catch {
        res.status(400).json({ error: "invalid X-PAYMENT header (expected base64-encoded JSON)" });
        return;
      }

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
      (req as PaidRequest).x402 = result;
      next();
    } catch (err) {
      res.status(502).json({ error: "x402 settlement failed", detail: (err as Error).message });
    }
  };
}
