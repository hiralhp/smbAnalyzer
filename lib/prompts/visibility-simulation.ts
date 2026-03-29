// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Visibility Simulation
//
// Simulates how a general-purpose AI assistant would answer a local business
// recommendation query — returning which specific real businesses it would
// most likely recall and recommend.
//
// Input: businessName, businessType, location, query
// Output: { competitors: [{ name, reason, confidence }] }
// ─────────────────────────────────────────────────────────────────────────────

export function buildVisibilitySimulationPrompt(
  businessName: string,
  query: string,
  businessType: string | null,
  location: string
): { system: string; user: string } {
  const system = `You are simulating how a general-purpose AI assistant would answer a local business recommendation query. Output valid JSON only — no markdown, no commentary.`;

  const locationLine = location ? `- Location: "${location}"` : "";
  const businessTypeLine = businessType ? `- Business type: "${businessType}"` : "";

  const user = `You are simulating how a general-purpose AI assistant answers a business recommendation query.

Given:
- Query: "${query}"
${businessTypeLine}
${locationLine}

Task:
Estimate which exact real businesses are most likely to be mentioned in an AI-generated answer to this query.

LOCALITY RULES:
- If the business type is LOCAL / physical (restaurant, hotel, salon, gym, bar, bakery, spa, etc.):
  - The query is location-aware even if not explicitly stated
  - Prioritize businesses in the SAME neighborhood or immediate area (${location || "the specified location"})
  - Only expand to city-wide results if there are genuinely not enough strong local matches
  - Do NOT default to national chains — prefer well-known local and independent businesses
  - Only include a national chain if it is genuinely the dominant answer for this specific query in this specific area

- If the business type is NON-LOCAL / online (SaaS, marketplace, e-commerce):
  - Ignore geographic constraints
  - Prioritize widely recognized, high-authority services

GROUNDING RULES (critical):
- Only name businesses you are HIGHLY CONFIDENT actually exist and are relevant to this query
- Do not invent, approximate, or confuse business names — when in doubt, omit
- Return fewer results (2–3) rather than padding with uncertain entries
- If "${businessName}" signals a price tier (fine dining, boutique, budget), prioritize similarly-positioned competitors

General rules:
- Only include real, specific businesses — no generic categories
- Return 3–5 businesses total (fewer if fewer strong matches exist)
- Prefer well-known local businesses, high-review places, or commonly recommended spots
- If "${businessName}" is a strong fit for this query, include it

For each business include:
- name
- short reason (why it would be recommended for this specific query)
- confidence: high / medium / low

Output JSON:
{
  "competitors": [
    {
      "name": "...",
      "reason": "...",
      "confidence": "high"
    }
  ]
}`;

  return { system, user };
}
