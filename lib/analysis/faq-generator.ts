// ─────────────────────────────────────────────────────────────────────────────
// FAQ Generator (Deterministic)
//
// Generates category-specific FAQ question rows for a report.
// No LLM — uses static templates from category-templates.ts.
// Answers are null; LLM can fill them in later as a separate step.
//
// Output is stored in report_faqs with source='deterministic'.
// LLM-generated answers/questions will be stored with source='llm' (never overwrites).
// ─────────────────────────────────────────────────────────────────────────────

import type { FaqRow } from "@/lib/types";
import { type CanonicalCategory, CATEGORY_FAQ_QUESTIONS } from "./category-templates";

/**
 * Generate deterministic FAQ question rows for a report.
 * Returns 8–10 category-specific questions with null answers.
 */
export function generateFaqs(canonicalCategory: CanonicalCategory): FaqRow[] {
  const questions = CATEGORY_FAQ_QUESTIONS[canonicalCategory]
    ?? CATEGORY_FAQ_QUESTIONS["generic"];

  return questions.map((question, index) => ({
    question,
    answer: undefined,
    category: canonicalCategory,
    source: "deterministic" as const,
    sortOrder: index,
  }));
}
