import { facilitatorWallet, publicClient } from "../chain";
import { paymentEscrowAbi } from "../abis";
import { config } from "../config";
import type { PaymentPayload } from "./types";

function splitSignature(sig: `0x${string}`): { r: `0x${string}`; s: `0x${string}`; v: number } {
  const h = sig.slice(2);
  const r = `0x${h.slice(0, 64)}` as `0x${string}`;
  const s = `0x${h.slice(64, 128)}` as `0x${string}`;
  let v = parseInt(h.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { r, s, v };
}

export interface SettleResult {
  success: boolean;
  transaction: `0x${string}`;
  payer: `0x${string}`;
}

/**
 * Settle on-chain via PaymentEscrow.settle. The facilitator wallet pays gas; the payer stays
 * gasless. The escrow derives the agent's payout wallet from the IdentityRegistry, so we only
 * pass agentId (never a payout address). taskId == the authorization nonce → replay-safe.
 */
export async function settlePayment(payload: PaymentPayload, agentId: bigint): Promise<SettleResult> {
  const a = payload.payload.authorization;
  const { r, s, v } = splitSignature(payload.payload.signature);
  const taskId = a.nonce;

  const hash = await facilitatorWallet.writeContract({
    address: config.PAYMENT_ESCROW as `0x${string}`,
    abi: paymentEscrowAbi,
    functionName: "settle",
    args: [
      taskId,
      agentId,
      a.from,
      BigInt(a.value),
      BigInt(a.validAfter),
      BigInt(a.validBefore),
      a.nonce,
      v,
      r,
      s,
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
  if (receipt.status !== "success") {
    // The on-chain settle reverted (e.g. nonce already used, unknown agent). The payer did NOT
    // pay — surface this so the caller never receives a paid result for free.
    throw new Error(`settlement transaction reverted (${hash})`);
  }
  return { success: true, transaction: hash, payer: a.from };
}
