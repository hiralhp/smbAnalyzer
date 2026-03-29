// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Competitor Discovery
//
// Asks Grok to suggest 3–5 real named competitors for a given business.
// Results are validated before being stored.
//
// Input: business context + already-known competitor domains to exclude
// Output: JSON array matching LlmDiscoveredCompetitor[]
// ─────────────────────────────────────────────────────────────────────────────

interface CompetitorDiscoveryContext {
  businessName: string;
  category: string | null;
  city: string;
  websiteUrl?: string;
  knownCompetitorDomains: string[];
}

export function buildCompetitorDiscoveryPrompt(ctx: CompetitorDiscoveryContext): {
  system: string;
  user: string;
} {
  const system = `You are a local business market research analyst. Given a business description, return 3–5 real, named competitors with their known domain names. Output valid JSON only — no markdown, no commentary.`;

  const knownList =
    ctx.knownCompetitorDomains.length > 0
      ? `\nAlready known competitors (exclude these): ${ctx.knownCompetitorDomains.join(", ")}`
      : "";

  const user = `Find 3–5 real competitors for this business.

## Business
- Name: ${ctx.businessName}
- Category: ${ctx.category ?? "Not specified"}
- Location: ${ctx.city || "Not specified"}
${ctx.websiteUrl ? `- Website: ${ctx.websiteUrl}` : ""}
${knownList}

## Output Format
Return ONLY this JSON array:
[
  { "name": "Competitor Name", "domain": "example.com" },
  ...
]

Rules:
- Use real businesses that actually exist (not invented names)
- Provide clean domain names only (no https://, no paths, no trailing slashes)
- Focus on direct competitors in the same city/region if local
- For national/online businesses, include well-known category leaders
- Exclude the business itself
- 3–5 results only`;

  return { system, user };
}
