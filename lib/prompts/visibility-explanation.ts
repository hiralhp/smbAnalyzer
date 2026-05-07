import type { VisibilitySimulationRow } from "@/lib/types";

interface VisibilityExplanationPrompt {
  system: string;
  user: string;
}

interface BusinessContext {
  name: string;
  sector: string;
  city: string;
  hasLocationMention: boolean;
  hasPricing: boolean;
  hasTrustSignals: boolean;
  hasServicePages: boolean;
  hasFaq: boolean;
}

export function buildVisibilityExplanationPrompt(
  missingRows: VisibilitySimulationRow[],
  business: BusinessContext
): VisibilityExplanationPrompt {
  const queryList = missingRows
    .map((r) => {
      const topCompetitors = r.mentionedCompanies
        .slice(0, 3)
        .map((c) => c.name)
        .join(", ");
      return `- Query: "${r.query}"\n  Companies that appeared: ${topCompetitors || "none recorded"}`;
    })
    .join("\n");

  const signals = [
    business.hasLocationMention && "location mentioned",
    business.hasPricing && "pricing info",
    business.hasTrustSignals && "trust signals",
    business.hasServicePages && "service pages",
    business.hasFaq && "FAQ section",
  ]
    .filter(Boolean)
    .join(", ") || "minimal signals detected";

  const system = `You are an AI search optimization expert explaining why a business doesn't appear in AI-generated recommendations.
Be specific, direct, and actionable. Write for a non-technical business owner.
Respond ONLY with a valid JSON array. No explanation outside the JSON.`;

  const user = `Business: ${business.name} (${business.sector}, ${business.city})
Current signals on their website: ${signals}

The following queries were simulated and this business did NOT appear in AI recommendations:
${queryList}

For each query, explain in 1–2 sentences:
1. The most likely reason the business didn't appear
2. The single most impactful thing they can add to their website to fix it

Return a JSON array:
[
  {
    "query": "<exact query string>",
    "explanation": "<1-2 sentence explanation + fix>"
  }
]`;

  return { system, user };
}
