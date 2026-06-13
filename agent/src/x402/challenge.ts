import { parseUnits } from "viem";
import { config } from "../config";
import type { PaymentRequirements } from "./types";

/** Convert a human price (e.g. "0.10") to USDC atomic units (6 decimals). */
export function priceToAtomic(price: string): bigint {
  return parseUnits(price, 6);
}

export function buildRequirements(args: {
  resource: string;
  description: string;
  domain: { name: string; version: string };
}): PaymentRequirements {
  return {
    scheme: "exact",
    network: `eip155:${config.CHAIN_ID}`,
    maxAmountRequired: priceToAtomic(config.PRICE_USDC).toString(),
    asset: config.USDC as `0x${string}`,
    payTo: config.PAYMENT_ESCROW as `0x${string}`,
    resource: args.resource,
    description: args.description,
    mimeType: "application/json",
    outputSchema: null,
    maxTimeoutSeconds: 120,
    extra: args.domain, // token EIP-712 domain (name/version) used to build the signature
  };
}

/** The HTTP 402 body: an x402 payment challenge. */
export function build402(requirements: PaymentRequirements) {
  return { x402Version: 1, error: "X-PAYMENT header is required", accepts: [requirements] };
}
