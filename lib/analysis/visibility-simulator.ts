// ─────────────────────────────────────────────────────────────────────────────
// Visibility Simulator v2
//
// Two-step simulation engine:
//   1. Generate 4–6 realistic user queries via LLM (category + location aware)
//   2. For each query, simulate a full AI assistant response (2–4 sentence prose)
//      and extract structured data: which businesses appear, how prominently,
//      and how richly the target business is mentioned.
//
// Coverage quality is based on RICHNESS OF MENTION — not keyword presence:
//   strong  = specific details (amenities, policies, reputation, pricing)
//   partial = generic mention ("is an option in the area")
//   weak    = not mentioned or overshadowed by competitors
//
// Returns null when businessName is empty, all LLM calls fail, or MOCK_LLM=true.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  QueryCoverageRow,
  VisibilitySimulationResult,
  VisibilitySimulationRow,
  VisibilityMention,
  LlmProvider,
} from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { buildVisibilityQueryGenPrompt } from "@/lib/prompts/visibility-query-gen";
import { buildAiResponseSimulationPrompt } from "@/lib/prompts/ai-response-simulator";

const MAX_QUERIES = 6;
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;
type Confidence = "high" | "medium" | "low";
type AppearanceType = "primary" | "secondary" | "absent";
type CoverageQuality = "strong" | "partial" | "weak";

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

interface ParsedBusiness {
  name: string;
  rank: "primary" | "secondary" | "mentioned";
  detail: string;
}

interface ParsedSimResult {
  query: string;
  simulatedResponse: string;
  businesses: ParsedBusiness[];
  targetAppears: boolean;
  appearanceType: AppearanceType;
  coverageQuality: CoverageQuality;
}

function parseSimulationResponse(raw: string, businessName: string, query: string): ParsedSimResult {
  const empty: ParsedSimResult = {
    query,
    simulatedResponse: "",
    businesses: [],
    targetAppears: false,
    appearanceType: "absent",
    coverageQuality: "weak",
  };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.error("[DIAG Sim] parseSimulationResponse: invalid JSON:", raw?.slice(0, 200));
    return empty;
  }

  const simulatedResponse = typeof parsed.response === "string" ? parsed.response.trim() : "";

  const businesses: ParsedBusiness[] = [];
  if (Array.isArray(parsed.businesses)) {
    for (const b of parsed.businesses) {
      if (
        typeof b === "object" &&
        b !== null &&
        typeof (b as Record<string, unknown>).name === "string"
      ) {
        const item = b as Record<string, unknown>;
        const rank = ["primary", "secondary", "mentioned"].includes(item.rank as string)
          ? (item.rank as "primary" | "secondary" | "mentioned")
          : "mentioned";
        businesses.push({
          name: item.name as string,
          rank,
          detail: typeof item.detail === "string" ? item.detail : "",
        });
      }
    }
  }

  const rawQuality = typeof parsed.targetCoverageQuality === "string"
    ? parsed.targetCoverageQuality.trim()
    : null;
  const coverageQuality: CoverageQuality =
    rawQuality === "strong" ? "strong" :
    rawQuality === "partial" ? "partial" :
    "weak";

  // Determine appearance using fuzzy match against the businesses list
  const targetBusiness = businesses.find((b) => businessAppears(businessName, [b]));
  const targetAppears = targetBusiness !== undefined;
  const appearanceType: AppearanceType =
    !targetAppears ? "absent" :
    targetBusiness.rank === "primary" ? "primary" : "secondary";

  console.log(
    `[DIAG Sim] Query: ${JSON.stringify(query)} → ${businesses.length} businesses, target: ${appearanceType}, quality: ${coverageQuality}`
  );

  return { query, simulatedResponse, businesses, targetAppears, appearanceType, coverageQuality };
}

/** Map rank → confidence for backward-compat with LlmCompetitorAnalysisRow.competitors */
function rankToConfidence(rank: "primary" | "secondary" | "mentioned"): Confidence {
  if (rank === "primary") return "high";
  if (rank === "secondary") return "medium";
  return "low";
}

/**
 * Full two-step visibility simulation:
 *  1. Generate 4–6 realistic queries (LLM) — falls back to queryCoverageRows on failure
 *  2. Simulate AI assistant response for each query, extract businesses + coverage quality
 *
 * Returns { result, rows } or null on complete failure.
 */
export async function simulateVisibility(
  businessName: string,
  queryCoverageRows: QueryCoverageRow[],
  businessType: string | null,
  location: string,
  providerOverride?: LlmProvider
): Promise<{ result: VisibilitySimulationResult; rows: VisibilitySimulationRow[] } | null> {
  if (!businessName) return null;

  let provider: LlmProvider;
  try {
    provider = providerOverride ?? getLlmProvider();
  } catch {
    return null;
  }

  // ── Step 1: Generate queries ───────────────────────────────────────────────
  let queries: string[] = [];
  try {
    const { system, user } = buildVisibilityQueryGenPrompt({
      businessName,
      businessType: businessType ?? "local business",
      location: location || "the local area",
    });
    const raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 300,
      temperature: 0.2,
      jsonMode: true,
    });
    const parsed = JSON.parse(raw) as { queries?: unknown };
    if (Array.isArray(parsed.queries)) {
      queries = parsed.queries
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .map((q) => q.trim())
        .slice(0, MAX_QUERIES);
    }
  } catch (err) {
    console.warn("[DIAG Sim] Query generation failed, falling back to queryCoverageRows:", err);
  }

  // Fallback: use non-weak queryCoverageRows if LLM query gen fails or returns too few
  if (queries.length < 3) {
    const pool = queryCoverageRows.filter(
      (q) => q.coverage !== "weak" && q.coverage !== "aspirational"
    );
    const fallback = (pool.length > 0 ? pool : queryCoverageRows)
      .slice(0, MAX_QUERIES)
      .map((q) => q.query);
    queries = [...queries, ...fallback.filter((q) => !queries.includes(q))].slice(0, MAX_QUERIES);
  }

  if (queries.length === 0) return null;

  console.log("[DIAG Sim] Running", queries.length, "simulations for:", businessName, "| type:", businessType, "| location:", location);

  // ── Step 2: Simulate AI responses in parallel ──────────────────────────────
  const simResults = await Promise.allSettled(
    queries.map(async (query) => {
      const { system, user } = buildAiResponseSimulationPrompt({
        query,
        businessName,
        businessType: businessType ?? "local business",
        location: location || "the local area",
      });
      const raw = await provider.complete({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens: 600,
        temperature: 0.3,
        jsonMode: true,
      });
      return parseSimulationResponse(raw, businessName, query);
    })
  );

  const failures = simResults.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    for (const f of failures) {
      console.error("[DIAG Sim] Query simulation failed:", (f as PromiseRejectedResult).reason);
    }
  }

  // ── Step 3: Aggregate results ──────────────────────────────────────────────
  const rows: VisibilitySimulationRow[] = [];
  const mentionCounts = new Map<
    string,
    { name: string; count: number; queries: string[]; topConfidence: Confidence }
  >();
  let analyzedBusinessMentions = 0;

  for (const result of simResults) {
    if (result.status !== "fulfilled") continue;
    const sim = result.value;

    // Map extracted businesses to the legacy mentionedCompanies shape
    const mentionedCompanies = sim.businesses
      .filter((b) => !businessAppears(businessName, [b])) // exclude the target itself
      .map((b) => ({
        name: b.name,
        reason: b.detail || `Mentioned as ${b.rank} recommendation`,
        confidence: rankToConfidence(b.rank),
      }));

    rows.push({
      query: sim.query,
      mentionedCompanies,
      analyzedBusinessAppears: sim.targetAppears,
      simulatedResponse: sim.simulatedResponse || undefined,
      appearanceType: sim.appearanceType,
      queryCoverageQuality: sim.coverageQuality,
    });

    if (sim.targetAppears) analyzedBusinessMentions++;

    for (const company of mentionedCompanies) {
      const key = normalizeName(company.name);
      const existing = mentionCounts.get(key);
      if (existing) {
        existing.count++;
        existing.queries.push(sim.query);
        if (CONFIDENCE_RANK[company.confidence] > CONFIDENCE_RANK[existing.topConfidence]) {
          existing.topConfidence = company.confidence;
        }
      } else {
        mentionCounts.set(key, {
          name: company.name,
          count: 1,
          queries: [sim.query],
          topConfidence: company.confidence,
        });
      }
    }
  }

  if (rows.length === 0) return null;

  const topMentions: VisibilityMention[] = Array.from(mentionCounts.values())
    .sort(
      (a, b) =>
        b.count - a.count ||
        CONFIDENCE_RANK[b.topConfidence] - CONFIDENCE_RANK[a.topConfidence]
    )
    .slice(0, 5)
    .map((m) => ({
      company: m.name,
      count: m.count,
      queries: m.queries,
      topConfidence: m.topConfidence,
    }));

  const queriesSimulated = rows.length;
  const analyzedBusinessAppears = analyzedBusinessMentions > 0;

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
