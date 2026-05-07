import type { QueryCoverageRow, LlmProvider, WebsiteAnalysis } from "@/lib/types";
import { buildQuerySemanticPrompt } from "@/lib/prompts/query-semantic";
import { isGroqQuotaError } from "@/lib/errors";

/**
 * Uses LLM to semantically re-evaluate weak/partial query coverage rows.
 * Only upgrades coverage — never downgrades deterministic results.
 * Returns the full rows array with upgrades applied.
 * Non-blocking: returns original rows on any failure.
 */
export async function enhanceQueryCoverageWithSemantics(
  rows: QueryCoverageRow[],
  analysis: WebsiteAnalysis,
  provider: LlmProvider
): Promise<QueryCoverageRow[]> {
  const candidateRows = rows.filter(
    (r) => r.coverage === "weak" || r.coverage === "partial"
  );

  if (candidateRows.length === 0) return rows;

  const bodyText = analysis.bodyTextSample ?? "";
  if (!bodyText.trim()) return rows;

  const { system, user } = buildQuerySemanticPrompt(candidateRows, bodyText);

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 800,
      temperature: 0,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[SemanticQueryEnhancer] LLM call failed:", err);
    return rows;
  }

  let verdicts: Array<{ query: string; covered: boolean; reason: string }>;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return rows;
    verdicts = parsed.filter(
      (v) =>
        typeof v.query === "string" &&
        typeof v.covered === "boolean" &&
        typeof v.reason === "string"
    );
  } catch {
    console.warn("[SemanticQueryEnhancer] JSON parse failed");
    return rows;
  }

  const verdictMap = new Map(verdicts.map((v) => [v.query, v]));

  return rows.map((row) => {
    const verdict = verdictMap.get(row.query);
    if (!verdict?.covered) return row;

    const semanticNote = `Semantically covered: ${verdict.reason}`;

    if (row.coverage === "weak") {
      return {
        ...row,
        coverage: "partial" as const,
        evidenceNote: row.evidenceNote
          ? `${row.evidenceNote}. ${semanticNote}`
          : semanticNote,
      };
    }
    if (row.coverage === "partial" && (row.titleMatch || row.headingMatch)) {
      return {
        ...row,
        coverage: "strong" as const,
        evidenceNote: row.evidenceNote
          ? `${row.evidenceNote}. ${semanticNote}`
          : semanticNote,
      };
    }
    return row;
  });
}
