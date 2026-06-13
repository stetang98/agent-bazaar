export type Severity = "high" | "medium" | "low" | "info";

export interface Finding {
  severity: Severity;
  line: number; // 1-based; 0 means file-level
  title: string;
  detail: string;
  suggestion: string;
}

interface LineRule {
  severity: Severity;
  title: string;
  detail: string;
  suggestion: string;
  pattern: RegExp;
}

/**
 * Deterministic Solidity pitfall checks. Used when no LLM key is configured (or the LLM call
 * fails) so the agent always returns a real result and the demo never breaks. Heuristic — not a
 * substitute for a full audit.
 */
const LINE_RULES: LineRule[] = [
  {
    severity: "high",
    title: "Use of tx.origin",
    pattern: /\btx\.origin\b/,
    detail: "Authorizing with tx.origin is phishable: a malicious intermediary contract passes the check.",
    suggestion: "Use msg.sender for authorization.",
  },
  {
    severity: "high",
    title: "selfdestruct present",
    pattern: /\bselfdestruct\s*\(/,
    detail: "selfdestruct can remove the contract and force-send ETH, breaking invariants for integrators.",
    suggestion: "Avoid selfdestruct; use explicit withdrawal/pause patterns.",
  },
  {
    severity: "high",
    title: "delegatecall usage",
    pattern: /\bdelegatecall\s*\(/,
    detail: "delegatecall runs external code in this contract's storage context — a common takeover vector.",
    suggestion: "Only delegatecall trusted, immutable targets and validate calldata.",
  },
  {
    severity: "high",
    title: "Weak on-chain randomness",
    pattern: /(block\.(timestamp|prevrandao|number)|blockhash)[\s\S]{0,40}%/,
    detail: "Block properties are validator-influenced and unsafe as a randomness source.",
    suggestion: "Use a verifiable randomness source such as Chainlink VRF.",
  },
  {
    severity: "medium",
    title: "Unchecked low-level call",
    pattern: /\.call\s*\{?[^;]*\}?\s*\(/,
    detail: "Low-level call returns a success boolean that must be checked; ignoring it hides failures.",
    suggestion: "Check the returned success flag, or use a vetted wrapper (e.g. Address.functionCall).",
  },
  {
    severity: "medium",
    title: "ecrecover without zero-address check",
    pattern: /\becrecover\s*\(/,
    detail: "ecrecover returns address(0) for malformed signatures, which can bypass naive checks.",
    suggestion: "Reject address(0) or use OpenZeppelin ECDSA, which reverts on bad signatures.",
  },
  {
    severity: "low",
    title: "ETH sent via transfer/send",
    pattern: /\.(transfer|send)\s*\(/,
    detail: "transfer/send forward only 2300 gas and can fail for contract recipients after gas repricings.",
    suggestion: "Prefer call{value: ...}(\"\") with checks-effects-interactions and a reentrancy guard.",
  },
  {
    severity: "low",
    title: "Floating pragma",
    pattern: /pragma\s+solidity\s+[\^>]/,
    detail: "A floating pragma may compile under an unintended compiler version.",
    suggestion: "Pin an exact compiler version for production deployments.",
  },
];

export function analyze(source: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((text, i) => {
    const code = text.replace(/\/\/.*$/, ""); // drop line comments to cut false positives
    for (const rule of LINE_RULES) {
      if (rule.pattern.test(code)) {
        findings.push({
          severity: rule.severity,
          line: i + 1,
          title: rule.title,
          detail: rule.detail,
          suggestion: rule.suggestion,
        });
      }
    }
  });

  if (!/SPDX-License-Identifier/.test(source)) {
    findings.push({
      severity: "info",
      line: 0,
      title: "Missing SPDX license identifier",
      detail: "No SPDX-License-Identifier was found in the source.",
      suggestion: "Add a `// SPDX-License-Identifier: <license>` header.",
    });
  }

  if (
    /\.call\s*\{\s*value/.test(source) &&
    /\b(balances|balanceOf|_balances)\b\s*\[/.test(source) &&
    !/nonReentrant/.test(source)
  ) {
    findings.push({
      severity: "medium",
      line: 0,
      title: "Possible reentrancy",
      detail: "An external value-bearing call coexists with balance bookkeeping and no reentrancy guard.",
      suggestion: "Apply checks-effects-interactions ordering and a nonReentrant guard.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      line: 0,
      title: "No heuristic issues found",
      detail: "The static analyzer matched no known pitfall patterns. This is not a guarantee of safety.",
      suggestion: "Follow up with a full manual audit and property-based tests.",
    });
  }

  return findings;
}
