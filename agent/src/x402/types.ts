/** EIP-3009 authorization the payer signs (ReceiveWithAuthorization, to = escrow). */
export interface Authorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string; // atomic units (string)
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`; // 32-byte hex
}

/** Decoded X-PAYMENT header payload (x402 "exact" scheme). */
export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string; // CAIP-2, e.g. "eip155:421614"
  payload: {
    signature: `0x${string}`;
    authorization: Authorization;
  };
}

/** A single entry in the 402 `accepts[]` array. */
export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  asset: `0x${string}`;
  payTo: `0x${string}`;
  resource: string;
  description: string;
  mimeType: string;
  outputSchema: null;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string }; // token EIP-712 domain
}
