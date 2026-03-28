// ─────────────────────────────────────────────────────────────────────────────
// Category Classifier
//
// Deterministic rule-based classifier. Returns a canonical category, confidence,
// and evidence string for every report.
//
// Priority:
//   1. User-provided form category → map to canonical via FORM_CATEGORY_MAP
//   2. Keyword scoring on title + headings + body text
//   3. Fallback → "generic"
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis } from "@/lib/types";
import {
  type CanonicalCategory,
  FORM_CATEGORY_MAP,
  CATEGORY_KEYWORDS,
} from "./category-templates";

export interface CategoryClassification {
  canonicalCategory: CanonicalCategory;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

/**
 * Classify a business into a canonical category.
 * Uses form input first, then website content inference.
 */
export function classifyCategory(
  formCategory: string | undefined,
  analysis: WebsiteAnalysis
): CategoryClassification {
  // ── Step 1: Map form-provided category ───────────────────────────────────
  if (formCategory?.trim()) {
    const mapped = FORM_CATEGORY_MAP[formCategory.trim()];
    if (mapped) {
      return {
        canonicalCategory: mapped,
        confidence: "high",
        evidence: `Form category "${formCategory}" mapped to ${mapped}.`,
      };
    }
  }

  // ── Step 2: Keyword scoring on website content ────────────────────────────
  if (!analysis.fetchError) {
    const contentText = [
      analysis.title ?? "",
      ...(analysis.h1Headings ?? []),
      ...(analysis.h2Headings ?? []),
      (analysis.bodyTextSample ?? "").slice(0, 800),
    ]
      .join(" ")
      .toLowerCase();

    const scores: Array<{ category: CanonicalCategory; score: number; matches: string[] }> = [];

    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [CanonicalCategory, string[]][]) {
      if (cat === "generic") continue;
      const matches = keywords.filter((kw) => contentText.includes(kw));
      if (matches.length > 0) {
        // Title/H1 hits count double
        const prominentText = [analysis.title ?? "", ...(analysis.h1Headings ?? [])]
          .join(" ")
          .toLowerCase();
        const prominentMatches = matches.filter((kw) => prominentText.includes(kw));
        const score = matches.length + prominentMatches.length;
        scores.push({ category: cat, score, matches: matches.slice(0, 3) });
      }
    }

    if (scores.length > 0) {
      scores.sort((a, b) => b.score - a.score);
      const best = scores[0];
      const confidence = best.score >= 4 ? "high" : best.score >= 2 ? "medium" : "low";
      return {
        canonicalCategory: best.category,
        confidence,
        evidence: `Keywords matched in website content: ${best.matches.join(", ")}.`,
      };
    }
  }

  // ── Step 3: Generic fallback ───────────────────────────────────────────────
  return {
    canonicalCategory: "generic",
    confidence: "low",
    evidence: "No category provided and no category-specific keywords detected.",
  };
}
