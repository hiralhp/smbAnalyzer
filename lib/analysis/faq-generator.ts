// ─────────────────────────────────────────────────────────────────────────────
// FAQ Generator (Deterministic)
//
// Generates pattern-specific FAQ rows using the website_pattern routing key.
// No LLM — uses static templates from website-pattern-templates.ts.
// Answers are null; LLM can fill them in later as a separate step.
//
// Output is stored in report_faqs with source='deterministic'.
// ─────────────────────────────────────────────────────────────────────────────

import type { FaqRow, BusinessProfile } from "@/lib/types";
import { PATTERN_FAQ_QUESTIONS } from "./website-pattern-templates";

/**
 * Generate deterministic FAQ question rows for a report.
 * Uses website_pattern as the single routing key — no multi-level fallback.
 */
export function generateFaqs(profile: BusinessProfile): FaqRow[] {
  const questions =
    PATTERN_FAQ_QUESTIONS[profile.website_pattern] ??
    PATTERN_FAQ_QUESTIONS["generic_unknown"];

  return questions.map((question, i) => ({
    question,
    answer: undefined,
    category: profile.website_pattern,
    source: "deterministic" as const,
    sortOrder: i,
  }));
}

/**
 * Build a plain-text FAQ draft from a list of questions.
 * Used as the deterministic fallback for contentAssetDraft when LLM is unavailable.
 * Questions should come from generateFaqs() so they are always category-specific.
 */
export function buildFaqDraft(questions: string[], businessName?: string): string {
  const header = businessName
    ? `## Frequently Asked Questions — ${businessName}`
    : "## Frequently Asked Questions";

  const lines: string[] = [header, ""];
  for (const q of questions) {
    lines.push(`**Q: ${q}**`);
    lines.push("A: [Write your answer here]");
    lines.push("");
  }
  lines.push("---");
  lines.push("Add your answers and publish this section to your website.");

  return lines.join("\n");
}
