import { config } from "../config";
import { analyze, type Finding, type Severity } from "../llm/fallbackAnalyzer";
import { auditWithOpenAI } from "../llm/openai";

export interface AuditResult {
  engine: "openai" | "static-analyzer";
  model?: string;
  findings: Finding[];
  summary: Record<Severity, number>;
}

/** Audit Solidity source. Prefers the LLM when a key is set; always falls back so it never throws. */
export async function auditSolidity(source: string): Promise<AuditResult> {
  let findings: Finding[];
  let engine: AuditResult["engine"] = "static-analyzer";
  let model: string | undefined;

  if (config.hasOpenAI) {
    try {
      findings = await auditWithOpenAI(source);
      engine = "openai";
      model = config.OPENAI_MODEL;
    } catch (err) {
      console.warn("[auditor] OpenAI failed; using static analyzer:", (err as Error).message);
      findings = analyze(source);
    }
  } else {
    findings = analyze(source);
  }

  const summary: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) summary[f.severity]++;

  return { engine, model, findings, summary };
}
