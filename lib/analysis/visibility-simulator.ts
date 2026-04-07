// ─────────────────────────────────────────────────────────────────────────────
// Visibility Simulator
//
// For each of up to 5 generated queries, asks the base LLM which specific
// real businesses it would most likely recommend — simulating AI search result
// presence. Results are aggregated into a VisibilitySimulationResult.
//
// Returns null when:
// - businessName is empty
// - No queryCoverageRows provided
// - MOCK_LLM=true (MockProvider → parse fails → null)
// - All LLM calls fail
// ─────────────────────────────────────────────────────────────────────────────

import type {
  QueryCoverageRow,
  VisibilitySimulationResult,
  VisibilitySimulationRow,
  VisibilityMention,
} from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { buildVisibilitySimulationPrompt } from "@/lib/prompts/visibility-simulation";

const MAX_QUERIES = 5;

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;
type Confidence = "high" | "medium" | "low";

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Fuzzy match: check if businessName appears among the recommended companies. */
function businessAppears(
  businessName: string,
  companies: Array<{ name: string }>
): boolean {
  const normalized = normalizeName(businessName);
  const parts = normalized.split(/\s+/).filter((p) => p.length > 3);
  if (parts.length === 0) return false;

  return companies.some((c) => {
    const cNorm = normalizeName(c.name);
    if (cNorm === normalized) return true;
    return parts.some((part) => cNorm.includes(part));
  });
}

function parseCompetitors(
  raw: string
): Array<{ name: string; reason: string; confidence: Confidence }> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[DIAG Sim] parseCompetitors: invalid JSON from LLM:", raw?.slice(0, 200));
    return [];
  }
  if (!Array.isArray(parsed.competitors)) return [];
  return (parsed.competitors as unknown[]).filter(
    (c): c is { name: string; reason: string; confidence: Confidence } =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as Record<string, unknown>).name === "string" &&
      ["high", "medium", "low"].includes(
        (c as Record<string, unknown>).confidence as string
      )
  ).map((c) => ({
    name: c.name,
    reason: typeof c.reason === "string" ? c.reason : "",
    confidence: c.confidence,
  }));
}

/**
 * Run visibility simulations for up to MAX_QUERIES queries and aggregate results.
 * Returns { result, rows } or null on complete failure.
 */
export async function simulateVisibility(
  businessName: string,
  queryCoverageRows: QueryCoverageRow[],
  businessType: string | null,
  location: string
): Promise<{ result: VisibilitySimulationResult; rows: VisibilitySimulationRow[] } | null> {
  if (!businessName || queryCoverageRows.length === 0) return null;

  let provider;
  try {
    provider = getLlmProvider();
  } catch {
    return null;
  }

  // Pick top queries — exclude Weak coverage (site has no evidence for them)
  // Fall back to full list only when everything is Weak (no-URL mode, etc.)
  const coverageOrder = { strong: 0, partial: 1, weak: 2, aspirational: 3 } as const;
  const pool = queryCoverageRows.filter((q) => q.coverage !== "weak" && q.coverage !== "aspirational");
  const selectedQueries = (pool.length > 0 ? pool : queryCoverageRows)
    .sort((a, b) => coverageOrder[a.coverage] - coverageOrder[b.coverage])
    .slice(0, MAX_QUERIES)
    .map((q) => q.query);

  console.log("[DIAG Sim] Running", selectedQueries.length, "visibility queries for:", businessName);

  // Run all simulations in parallel
  const simResults = await Promise.allSettled(
    selectedQueries.map(async (query) => {
      const { system, user } = buildVisibilitySimulationPrompt(
        businessName,
        query,
        businessType,
        location
      );
      const raw = await provider.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens: 500,
        temperature: 0.1,
        jsonMode: true,
      });
      const companies = parseCompetitors(raw);
      console.log("[DIAG Sim] Query:", JSON.stringify(query), "→", companies.length, "companies:", companies.map(c => c.name).join(", ") || "(none)");
      return { query, companies };
    })
  );

  const failures = simResults.filter(r => r.status === "rejected");
  if (failures.length > 0) {
    for (const f of failures) {
      console.error("[DIAG Sim] Query failed:", (f as PromiseRejectedResult).reason);
    }
  }

  // Aggregate results
  const rows: VisibilitySimulationRow[] = [];
  // Key by normalized name — LLM won't reliably return domains
  const mentionCounts = new Map<
    string,
    { name: string; count: number; queries: string[]; topConfidence: Confidence }
  >();
  let analyzedBusinessMentions = 0;

  for (const result of simResults) {
    if (result.status !== "fulfilled") continue;
    const { query, companies } = result.value;
    const appears = businessAppears(businessName, companies);

    rows.push({
      query,
      mentionedCompanies: companies,
      analyzedBusinessAppears: appears,
    });

    if (appears) analyzedBusinessMentions++;

    for (const company of companies) {
      const key = normalizeName(company.name);
      const existing = mentionCounts.get(key);
      if (existing) {
        existing.count++;
        existing.queries.push(query);
        // Track highest confidence seen across queries
        if (CONFIDENCE_RANK[company.confidence] > CONFIDENCE_RANK[existing.topConfidence]) {
          existing.topConfidence = company.confidence;
        }
      } else {
        mentionCounts.set(key, {
          name: company.name,
          count: 1,
          queries: [query],
          topConfidence: company.confidence,
        });
      }
    }
  }

  if (rows.length === 0) return null;

  const topMentions: VisibilityMention[] = Array.from(mentionCounts.values())
    .sort((a, b) => b.count - a.count || CONFIDENCE_RANK[b.topConfidence] - CONFIDENCE_RANK[a.topConfidence])
    .slice(0, 5)
    .map((m) => ({
      company: m.name,
      count: m.count,
      queries: m.queries,
      topConfidence: m.topConfidence,
    }));

  const queriesSimulated = rows.length;
  const analyzedBusinessAppears = analyzedBusinessMentions > 0;

  // Build plain-language insight (no ranking claims)
  let insight: string;
  if (analyzedBusinessMentions === 0) {
    insight = `${businessName} did not appear in AI responses for the ${queriesSimulated} simulated quer${queriesSimulated === 1 ? "y" : "ies"}.`;
  } else if (analyzedBusinessMentions === queriesSimulated) {
    insight = `${businessName} appeared in AI responses for all ${queriesSimulated} simulated quer${queriesSimulated === 1 ? "y" : "ies"}.`;
  } else {
    insight = `${businessName} appeared in AI responses for ${analyzedBusinessMentions} of ${queriesSimulated} simulated queries.`;
  }

  const simulationResult: VisibilitySimulationResult = {
    analyzedBusinessName: businessName,
    insight,
    analyzedBusinessMentions,
    analyzedBusinessAppears,
    topMentions,
    queriesSimulated,
  };

  return { result: simulationResult, rows };
}
