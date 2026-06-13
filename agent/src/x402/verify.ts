import { getAddress, recoverTypedDataAddress } from "viem";
import { publicClient } from "../chain";
import { usdcAbi } from "../abis";
import { config } from "../config";
import type { PaymentPayload, PaymentRequirements } from "./types";

const RECEIVE_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface VerifyResult {
  isValid: boolean;
  reason?: string;
  payer?: `0x${string}`;
}

/** Verify an x402 "exact" payment: signature recovers to `from`, amount/window/asset OK, balance sufficient. */
export async function verifyPayment(
  payload: PaymentPayload,
  req: PaymentRequirements,
  domain: { name: string; version: string },
): Promise<VerifyResult> {
  const a = payload.payload.authorization;

  if (payload.scheme !== "exact" || payload.network !== req.network) {
    return { isValid: false, reason: "scheme/network mismatch" };
  }
  if (getAddress(a.to) !== getAddress(req.payTo)) {
    return { isValid: false, reason: "payTo must be the escrow" };
  }
  if (BigInt(a.value) < BigInt(req.maxAmountRequired)) {
    return { isValid: false, reason: "insufficient amount" };
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (BigInt(a.validAfter) >= now) return { isValid: false, reason: "authorization not yet valid" };
  if (BigInt(a.validBefore) <= now) return { isValid: false, reason: "authorization expired" };

  const recovered = await recoverTypedDataAddress({
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: config.CHAIN_ID,
      verifyingContract: req.asset,
    },
    types: RECEIVE_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message: {
      from: a.from,
      to: a.to,
      value: BigInt(a.value),
      validAfter: BigInt(a.validAfter),
      validBefore: BigInt(a.validBefore),
      nonce: a.nonce,
    },
    signature: payload.payload.signature,
  });
  if (getAddress(recovered) !== getAddress(a.from)) {
    return { isValid: false, reason: "signature does not match `from`" };
  }

  const balance = (await publicClient.readContract({
    address: req.asset,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: [a.from],
  })) as bigint;
  if (balance < BigInt(a.value)) return { isValid: false, reason: "insufficient USDC balance" };

  return { isValid: true, payer: getAddress(a.from) };
}
