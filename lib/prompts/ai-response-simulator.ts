// ─────────────────────────────────────────────────────────────────────────────
// Prompt: AI Response Simulator
//
// Simulates how a helpful AI assistant (ChatGPT/Perplexity style) would
// actually answer a local business query. Returns:
//   - A natural-language prose response (2–4 sentences)
//   - Structured extraction: which businesses appear and how
//   - Coverage quality for the target business (strong/partial/weak)
//
// Key principle: the LLM decides whether the target appears — it is NOT
// forced into the response. Coverage reflects actual mention richness.
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulationContext {
  query: string;
  businessName: string;
  businessType: string;
  location: string;
}

export function buildAiResponseSimulationPrompt(ctx: SimulationContext): { system: string; user: string } {
  const system = `You simulate how a helpful AI assistant (like ChatGPT or Perplexity) would respond to a local business query.

Your simulated response must:
- Be 2–4 sentences of natural, conversational prose
- Mention 2–4 specific real or plausible local businesses naturally
- Include concrete details when you're confident (amenities, policies, price tier, reputation)
- NOT force-include "${ctx.businessName}" — only mention it if it genuinely fits the query
- Sound like a real AI assistant, not a template or list

Coverage quality for "${ctx.businessName}":
- "strong": mentioned with specific details (e.g., amenities, policies, known for X, price range)
- "partial": mentioned but only generically (e.g., "is an option", "located nearby")
- "weak": not mentioned at all, or only mentioned in passing to be compared unfavorably

Rank definitions:
- "primary": first/main recommendation with most detail
- "secondary": clearly recommended but with less emphasis
- "mentioned": briefly noted, minor mention

Return valid JSON only:
{
  "response": "Your 2–4 sentence natural language AI assistant answer here",
  "businesses": [
    {"name": "Business Name", "rank": "primary", "detail": "specific detail from the response"},
    {"name": "Other Business", "rank": "secondary", "detail": "what was said about them"}
  ],
  "targetCoverageQuality": "strong" | "partial" | "weak"
}`;

  const user = `Query: "${ctx.query}"
Location: ${ctx.location || "unspecified"}
Business type: ${ctx.businessType}
Target business: "${ctx.businessName}"

Simulate the AI assistant response. Only include "${ctx.businessName}" if it genuinely fits this specific query.`;

  return { system, user };
}
