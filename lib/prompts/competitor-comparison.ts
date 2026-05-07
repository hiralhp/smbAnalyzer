interface CompetitorComparisonPrompt {
  system: string;
  user: string;
}

interface BusinessSignals {
  name: string;
  hasServicePages: boolean;
  hasFaq: boolean;
  hasLocationMention: boolean;
  hasTrustSignals: boolean;
  hasContactInfo: boolean;
  hasHours: boolean;
  hasPricing: boolean;
  hasTestimonials: boolean;
}

interface CompetitorEntry {
  name: string;
  websiteUrl: string;
  signals: BusinessSignals;
}

export function buildCompetitorComparisonPrompt(
  business: BusinessSignals,
  competitors: CompetitorEntry[]
): CompetitorComparisonPrompt {
  const formatSignals = (s: BusinessSignals) =>
    [
      s.hasServicePages && "service pages",
      s.hasFaq && "FAQ",
      s.hasLocationMention && "location signals",
      s.hasTrustSignals && "trust signals",
      s.hasContactInfo && "contact info",
      s.hasHours && "hours",
      s.hasPricing && "pricing",
      s.hasTestimonials && "testimonials",
    ]
      .filter(Boolean)
      .join(", ") || "no notable signals";

  const competitorList = competitors
    .map(
      (c, i) =>
        `${i + 1}. ${c.name} (${c.websiteUrl})\n   Signals: ${formatSignals(c.signals)}`
    )
    .join("\n");

  const system = `You are an AI search optimization expert writing concise competitive analysis for small business owners.
Write from the perspective of how AI assistants (like ChatGPT, Perplexity) would perceive each business.
Respond ONLY with a valid JSON array. One sentence per comparison. No jargon.`;

  const user = `Analyzed business: ${business.name}
Their signals: ${formatSignals(business)}

Competitors:
${competitorList}

For each competitor, write one clear sentence comparing them to ${business.name} — focusing on which has stronger AI discoverability signals and why.
Be specific (e.g. "Competitor X has clearer pricing info, giving them an edge for cost-comparison queries").

Return a JSON array:
[
  {
    "websiteUrl": "<exact url from input>",
    "comparisonNote": "<one sentence>"
  }
]`;

  return { system, user };
}
