export type Severity = "high" | "medium" | "low" | "info";

export interface Finding {
  severity: Severity;
  line: number;
  title: string;
  detail: string;
  suggestion: string;
}

export interface AuditResult {
  engine: "openai" | "static-analyzer";
  model?: string;
  findings: Finding[];
  summary: Record<Severity, number>;
  payment?: { transaction: string; payer: string } | null;
}

export interface RegistrationJson {
  name: string;
  description: string;
  image?: string;
  services?: { name: string; endpoint: string; version?: string }[];
  x402Support?: boolean;
}

export interface Agent {
  agentId: bigint;
  owner: `0x${string}`;
  agentWallet: `0x${string}`;
  uri: string;
  registration?: RegistrationJson;
  ratingCount: number;
  ratingValue: number; // human scale, e.g. 4.5
  webEndpoint?: string; // resolved base URL of the agent service
}
