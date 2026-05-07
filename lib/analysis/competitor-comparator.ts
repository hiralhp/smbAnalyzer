import type { LlmProvider, WebsiteAnalysis, BusinessProfile } from "@/lib/types";
import { buildCompetitorComparisonPrompt } from "@/lib/prompts/competitor-comparison";
import { isGroqQuotaError } from "@/lib/errors";

/**
 * Uses LLM to generate a one-sentence competitive comparison for each competitor.
 * Returns a map of websiteUrl → comparisonNote.
 * Non-blocking: returns {} on any failure.
 */
export async function compareWithCompetitors(
  businessAnalysis: WebsiteAnalysis,
  competitorAnalyses: WebsiteAnalysis[],
  businessProfile: BusinessProfile,
  provider: LlmProvider
): Promise<Record<string, string>> {
  if (competitorAnalyses.length === 0) return {};

  const toSignals = (a: WebsiteAnalysis) => ({
    name: a.title ?? a.url,
    hasServicePages: a.hasServicePages ?? false,
    hasFaq: a.hasFaq ?? false,
    hasLocationMention: a.hasLocationMention ?? false,
    hasTrustSignals: a.hasTrustSignals ?? false,
    hasContactInfo: a.hasContactInfo ?? false,
    hasHours: a.hasHours ?? false,
    hasPricing: a.hasPricing ?? false,
    hasTestimonials: a.hasTestimonials ?? false,
  });

  const businessSignals = {
    ...toSignals(businessAnalysis),
    name: businessProfile.sector ?? businessAnalysis.title ?? businessAnalysis.url,
  };

  const competitors = competitorAnalyses
    .filter((c) => c.isCompetitor)
    .map((c) => ({
      name: c.competitorName ?? c.title ?? c.url,
      websiteUrl: c.url,
      signals: toSignals(c),
    }));

  if (competitors.length === 0) return {};

  const { system, user } = buildCompetitorComparisonPrompt(businessSignals, competitors);

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 600,
      temperature: 0.2,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[CompetitorComparator] LLM call failed:", err);
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    const result: Record<string, string> = {};
    for (const item of parsed) {
      if (typeof item.websiteUrl === "string" && typeof item.comparisonNote === "string") {
        result[item.websiteUrl] = item.comparisonNote;
      }
    }
    return result;
  } catch {
    console.warn("[CompetitorComparator] JSON parse failed");
    return {};
  }
}
