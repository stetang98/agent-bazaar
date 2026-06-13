import "dotenv/config";
import { z } from "zod";

const addr = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x address");
const pk = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "must be a 0x-prefixed 32-byte private key");

const EnvSchema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().default(421614),
  AGENT_PK: pk,
  FACILITATOR_PK: z.preprocess((v) => (v === "" ? undefined : v), pk.optional()),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  IDENTITY_REGISTRY: addr,
  REPUTATION_REGISTRY: addr,
  PAYMENT_ESCROW: addr,
  USDC: addr.default("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"),
  PUBLIC_URL: z.string().url().default("http://localhost:8787"),
  PRICE_USDC: z.string().regex(/^\d+(\.\d+)?$/, "must be a decimal like 0.10").default("0.10"),
  AGENT_ID: z.string().optional(),
  PORT: z.coerce.number().int().default(8787),
  ALLOWED_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment. Fix agent/.env (see .env.example):");
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const data = parsed.data;

export const config = {
  ...data,
  // Facilitator key defaults to the agent key for a single-operator hackathon setup.
  FACILITATOR_PK: data.FACILITATOR_PK ?? data.AGENT_PK,
  hasOpenAI: Boolean(data.OPENAI_API_KEY && data.OPENAI_API_KEY.trim().length > 0),
} as const;

export type Config = typeof config;
