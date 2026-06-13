import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config";
import { getUsdcDomain } from "../x402/usdcDomain";

/**
 * End-to-end x402 client: signs a ReceiveWithAuthorization (gasless), builds the X-PAYMENT header,
 * and calls the agent's paid /audit route. Requires PAYER_PK (a wallet with test USDC) in env.
 * Run: PAYER_PK=0x... npm run pay-test
 */
const PAYER_PK = process.env.PAYER_PK as `0x${string}` | undefined;
if (!PAYER_PK) {
  console.error("Set PAYER_PK (a funded test wallet holding Arb Sepolia USDC).");
  process.exit(1);
}

const SAMPLE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Vuln {
    mapping(address => uint256) public balances;
    function withdraw() external {
        uint256 bal = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: bal}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}`;

async function main(): Promise<void> {
  const account = privateKeyToAccount(PAYER_PK!);
  const wallet = createWalletClient({ account, chain: arbitrumSepolia, transport: http(config.RPC_URL) });
  const domain = await getUsdcDomain();

  const value = parseUnits(config.PRICE_USDC, 6);
  const validAfter = 0n;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 600);
  const nonce = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  const escrow = config.PAYMENT_ESCROW as `0x${string}`;

  const signature = await wallet.signTypedData({
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: config.CHAIN_ID,
      verifyingContract: config.USDC as `0x${string}`,
    },
    types: {
      ReceiveWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "ReceiveWithAuthorization",
    message: { from: account.address, to: escrow, value, validAfter, validBefore, nonce },
  });

  const xPayment = {
    x402Version: 1,
    scheme: "exact",
    network: `eip155:${config.CHAIN_ID}`,
    payload: {
      signature,
      authorization: {
        from: account.address,
        to: escrow,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
  const header = Buffer.from(JSON.stringify(xPayment)).toString("base64");

  const res = await fetch(`${config.PUBLIC_URL}/agents/auditor/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PAYMENT": header },
    body: JSON.stringify({ source: SAMPLE }),
  });
  console.log("HTTP", res.status);
  console.log("X-PAYMENT-RESPONSE:", res.headers.get("x-payment-response"));
  console.log(JSON.stringify(await res.json(), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
