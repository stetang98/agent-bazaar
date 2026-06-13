import { toHex, type WalletClient } from "viem";
import type { AuditResult } from "./types";
import { AGENT_BASE_URL } from "./addresses";

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  resource: string;
  description: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

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

function auditUrl(webEndpoint?: string): string {
  const base = webEndpoint?.replace(/\/+$/, "") || AGENT_BASE_URL;
  return `${base}/agents/auditor/audit`;
}

export interface PayAndAuditArgs {
  walletClient: WalletClient;
  account: `0x${string}`;
  chainId: number;
  source: string;
  webEndpoint?: string;
}

export interface PayAndAuditResult {
  audit: AuditResult;
  paymentTx?: string;
}

/** Drive the full x402 "exact" flow from the browser: 402 → sign (gasless) → retry → result. */
export async function payAndAudit(args: PayAndAuditArgs): Promise<PayAndAuditResult> {
  const { walletClient, account, chainId, source, webEndpoint } = args;
  const url = auditUrl(webEndpoint);
  const body = JSON.stringify({ source });

  // 1) Unpaid request — expect HTTP 402 with payment requirements.
  const challenge = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (challenge.status !== 402) {
    if (challenge.ok) return { audit: (await challenge.json()) as AuditResult };
    throw new Error(`Unexpected ${challenge.status}: ${await challenge.text()}`);
  }
  const { accepts } = (await challenge.json()) as { accepts: PaymentRequirements[] };
  const req = accepts[0];
  if (!req) throw new Error("402 response had no payment requirements");

  // 2) Sign the EIP-3009 ReceiveWithAuthorization (off-chain, gasless for the payer).
  const value = BigInt(req.maxAmountRequired);
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + req.maxTimeoutSeconds);
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));

  const signature = await walletClient.signTypedData({
    account,
    domain: { name: req.extra.name, version: req.extra.version, chainId, verifyingContract: req.asset },
    types: RECEIVE_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message: { from: account, to: req.payTo, value, validAfter, validBefore, nonce },
  });

  // 3) Retry with the X-PAYMENT header; the agent verifies + settles on-chain.
  const xPayment = {
    x402Version: 1,
    scheme: "exact",
    network: req.network,
    payload: {
      signature,
      authorization: {
        from: account,
        to: req.payTo,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
  const paid = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": btoa(JSON.stringify(xPayment)) },
    body,
  });
  if (!paid.ok) throw new Error(`Payment/audit failed ${paid.status}: ${await paid.text()}`);

  const audit = (await paid.json()) as AuditResult;
  let paymentTx: string | undefined;
  const respHeader = paid.headers.get("x-payment-response");
  if (respHeader) {
    try {
      paymentTx = (JSON.parse(atob(respHeader)) as { transaction?: string }).transaction;
    } catch {
      /* ignore malformed receipt header */
    }
  }
  return { audit, paymentTx };
}
