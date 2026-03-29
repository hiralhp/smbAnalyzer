// ─────────────────────────────────────────────────────────────────────────────
// Prompt: Grok Enhancement
//
// Single prompt that takes the normalized deterministic report object and
// produces four enhancement outputs in one call:
//   1. Enhanced positioning summary
//   2. Enhanced recommendation explanations (keyed by title)
//   3. Draft FAQ answers (never invented facts — placeholders when missing)
//   4. Optional quick-wins vs bigger-lifts bucketing
//
// Input: structured JSON — NO raw HTML
// Output: strict JSON matching GrokEnhancement type
// ─────────────────────────────────────────────────────────────────────────────

import type { GrokEnhancementInput } from "@/lib/types";

export function buildGrokEnhancementPrompt(input: GrokEnhancementInput): {
  system: string;
  user: string;
} {
  const system = `You are a specialist consultant writing AI search visibility reports for small businesses.

You receive a structured JSON object with deterministic analysis findings and produce enhanced narrative outputs.

CRITICAL RULES — read carefully:
1. ONLY use information explicitly provided in the input. Never infer or invent facts not present.
2. For FAQ answers: when specific business information is missing (hours, pricing, address, parking, specific services), use specific editable placeholders in square brackets, e.g. "[Add your hours here]", "[Enter your starting price]", "[Describe your parking options]". Never make up specific details.
3. Good placeholder: "We're open [add your hours here], including weekends."
4. Bad placeholder: "We're open Monday–Friday 9am–5pm." — never invent specific hours.
5. Tone: professional, warm, direct. Sound like a consultant who knows this business category.
6. For recommendation explanations: explain WHY each matters specifically for AI discoverability and for this business type. Be concrete. Do not repeat the title.
7. For the positioning summary: 2–4 sentences, grounded only in the detected strengths and gaps provided.
8. Do NOT change the ranked order of recommendations. Do NOT add new recommendations.
9. Quick wins = low effort. Bigger lifts = medium or high effort. Use the effort field provided.
10. Output: valid JSON only. No markdown fences. No commentary outside the JSON.`;

  const recTitles = input.recommendations.map((r) => r.title);

  const recList = input.recommendations
    .map(
      (r, i) =>
        `${i + 1}. "${r.title}" [impact: ${r.impact}, effort: ${r.effort}]: ${r.description}`
    )
    .join("\n");

  const faqList = input.faq_questions
    .map((q, i) => `${i + 1}. ${q}`)
    .join("\n");

  const recSchema = recTitles
    .map((t) => `    "${t.replace(/"/g, '\\"')}": "improved explanation..."`)
    .join(",\n");

  const faqSchema = input.faq_questions
    .map((q) => `    { "question": "${q.replace(/"/g, '\\"')}", "answer": "draft answer..." }`)
    .join(",\n");

  const user = `Produce enhanced narrative content for this AI Visibility Report. Use ONLY the data below.

## Business
- Name: ${input.business.name}
- Category: ${input.business.category ?? "Not specified"}
- Subtype: ${input.business.subtype ?? "Not specified"}
- Location: ${input.business.location || "Not specified"}

## AI Readiness Scores (0–100)
- Overall: ${input.scores.overall}
- Content Clarity: ${input.scores.contentClarity}
- Service Specificity: ${input.scores.serviceSpecificity}
- Local Relevance: ${input.scores.localRelevance}
- Trust Signals: ${input.scores.trustSignals}
- FAQ / Discoverability: ${input.scores.faqDiscoverability}

## Detected Strengths
${input.strengths.length > 0
    ? input.strengths.map((s) => `- ${s.label}${s.detail ? `: ${s.detail}` : ""}`).join("\n")
    : "None detected"}

## Detected Gaps
${input.gaps.length > 0
    ? input.gaps.map((g) => `- ${g.label}${g.detail ? `: ${g.detail}` : ""}`).join("\n")
    : "None detected"}

## Recommendations (ranked — do NOT reorder, do NOT add new ones)
${recList || "None"}

## FAQ Questions to Draft Answers For
${faqList || "None"}

---

Respond with this exact JSON schema:
{
  "enhanced_positioning_summary": "2–4 sentence paragraph grounded in the detected signals only",
  "enhanced_recommendation_explanations": {
${recSchema || '    "Example rec": "explanation"'}
  },
  "enhanced_faq_answers": [
${faqSchema || '    { "question": "example?", "answer": "draft answer" }'}
  ],
  "optional_quick_wins_bucket": {
    "quick_wins": ["rec titles where effort is low"],
    "bigger_lifts": ["rec titles where effort is medium or high"]
  }
}`;

  return { system, user };
}
