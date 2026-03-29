// ─────────────────────────────────────────────────────────────────────────────
// Archetype Classifier
//
// Returns an ArchetypeClassification for every report.
//
// Priority:
//   1. User-provided form category → ARCHETYPE_FORM_MAP lookup (confidence=1.0)
//      then run subtype detection on website content
//   2. Keyword scoring on title + headings + body text
//      winner = archetype with highest normalized score
//      confidence = normalizedScore × (0.5 + 0.5 × separation), capped at 0.95
//   3. Fallback → generic_unknown, confidence=0
//
// Subtype detection (shared between path 1 and 2):
//   - Same title/H1 3×, H2 2×, body 1× weighting
//   - Normalize by keywords.length × 3
//   - Return null if score < 0.65 OR gap to 2nd-best < 0.15
// ─────────────────────────────────────────────────────────────────────────────

import type { WebsiteAnalysis, ArchetypeClassification, ClassificationEvidence, BusinessArchetype } from "@/lib/types";
import {
  ARCHETYPE_FORM_MAP,
  ARCHETYPE_KEYWORDS,
  ARCHETYPE_SUBTYPES,
  SUBTYPE_CONFIDENCE_THRESHOLD,
  SUBTYPE_SEPARATION_MIN,
  ARCHETYPE_MIN_SCORE,
} from "./archetype-templates";

// ── Evidence builder ──────────────────────────────────────────────────────────

function buildEvidence(analysis: WebsiteAnalysis): ClassificationEvidence {
  const titleText = (analysis.title ?? "").toLowerCase();
  const headingText = [
    ...(analysis.h1Headings ?? []),
    ...(analysis.h2Headings ?? []),
  ].join(" ").toLowerCase();
  const navText = (analysis.internalLinks ?? []).join(" ").toLowerCase();
  const bodyText = (analysis.bodyTextSample ?? "").toLowerCase();

  const COMMERCE_TERMS = ["buy", "add to cart", "shop", "order online", "checkout", "purchase"];
  const BOOKING_TERMS = ["book", "appointment", "schedule", "reserve", "booking", "calendar"];
  const MENU_TERMS = ["menu", "specials", "appetizer", "entree", "drink menu", "brunch menu"];
  const LOCATION_TERMS = ["serving", "located", "based in", "near", "service area", "we serve"];
  const TRUST_TERMS = ["licensed", "insured", "certified", "accredited", "bonded", "guaranteed", "warranty"];
  const SERVICE_TERMS = ["services", "solutions", "treatments", "programs", "offerings", "packages"];

  const allText = `${titleText} ${headingText} ${bodyText}`;

  return {
    keywordHits: [],       // populated by archetype scoring
    headingHits: analysis.h1Headings.concat(analysis.h2Headings).slice(0, 6),
    structuredDataHits: [], // cheerio doesn't parse structured data — future extension
    navHits: navText.split(/\s+/).filter((w) => w.length > 3).slice(0, 10),
    serviceTermHits: SERVICE_TERMS.filter((t) => allText.includes(t)),
    commerceHits: COMMERCE_TERMS.filter((t) => allText.includes(t)),
    bookingHits: BOOKING_TERMS.filter((t) => allText.includes(t)),
    menuHits: MENU_TERMS.filter((t) => allText.includes(t)),
    locationHits: LOCATION_TERMS.filter((t) => allText.includes(t)),
    trustHits: TRUST_TERMS.filter((t) => allText.includes(t)),
  };
}

// ── Archetype scoring ─────────────────────────────────────────────────────────

interface ArchetypeScore {
  archetype: BusinessArchetype;
  normalizedScore: number;
  keywordHits: string[];
  rawHitCount: number;
}

function scoreArchetypes(analysis: WebsiteAnalysis): ArchetypeScore[] {
  const titleText = (analysis.title ?? "").toLowerCase();
  const h1Text = (analysis.h1Headings ?? []).join(" ").toLowerCase();
  const h2Text = (analysis.h2Headings ?? []).join(" ").toLowerCase();
  const bodyText = (analysis.bodyTextSample ?? "").slice(0, 800).toLowerCase();

  const results: ArchetypeScore[] = [];

  for (const [archetype, keywords] of Object.entries(ARCHETYPE_KEYWORDS) as [BusinessArchetype, string[]][]) {
    if (archetype === "generic_unknown" || keywords.length === 0) continue;

    let weightedScore = 0;
    const hits: string[] = [];

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      let kwScore = 0;

      if (titleText.includes(kwLower) || h1Text.includes(kwLower)) {
        kwScore += 3; // title/H1 = 3×
      } else if (h2Text.includes(kwLower)) {
        kwScore += 2; // H2 = 2×
      } else if (bodyText.includes(kwLower)) {
        kwScore += 1; // body = 1×
      }

      if (kwScore > 0) {
        weightedScore += kwScore;
        hits.push(kw);
      }
    }

    if (hits.length >= 1) {
      // Normalize: max possible = keywords.length × 3 (all in title/H1)
      const normalizedScore = weightedScore / (keywords.length * 3);
      results.push({
        archetype,
        normalizedScore,
        keywordHits: hits,
        rawHitCount: hits.length,
      });
    }
  }

  results.sort((a, b) => b.normalizedScore - a.normalizedScore);
  return results;
}

// ── Subtype classification ────────────────────────────────────────────────────

interface SubtypeScore {
  name: string;
  normalizedScore: number;
}

function classifySubtype(
  archetype: BusinessArchetype,
  analysis: WebsiteAnalysis
): { subtype: string; subtypeConfidence: number } | null {
  const subtypes = ARCHETYPE_SUBTYPES[archetype];
  if (!subtypes || subtypes.length === 0) return null;

  const titleText = (analysis.title ?? "").toLowerCase();
  const h1Text = (analysis.h1Headings ?? []).join(" ").toLowerCase();
  const h2Text = (analysis.h2Headings ?? []).join(" ").toLowerCase();
  const bodyText = (analysis.bodyTextSample ?? "").slice(0, 800).toLowerCase();

  const scores: SubtypeScore[] = [];

  for (const subtype of subtypes) {
    let weightedScore = 0;

    for (const kw of subtype.keywords) {
      const kwLower = kw.toLowerCase();
      if (titleText.includes(kwLower) || h1Text.includes(kwLower)) {
        weightedScore += 3;
      } else if (h2Text.includes(kwLower)) {
        weightedScore += 2;
      } else if (bodyText.includes(kwLower)) {
        weightedScore += 1;
      }
    }

    const normalizedScore = weightedScore / (subtype.keywords.length * 3);
    if (normalizedScore > 0) {
      scores.push({ name: subtype.name, normalizedScore });
    }
  }

  if (scores.length === 0) return null;

  scores.sort((a, b) => b.normalizedScore - a.normalizedScore);
  const best = scores[0];
  const secondBest = scores[1];

  // Must pass both threshold and separation requirements
  if (best.normalizedScore < SUBTYPE_CONFIDENCE_THRESHOLD) return null;
  if (secondBest && (best.normalizedScore - secondBest.normalizedScore) < SUBTYPE_SEPARATION_MIN) return null;

  return { subtype: best.name, subtypeConfidence: best.normalizedScore };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify a business into an archetype (and optionally a subtype).
 *
 * Returns ArchetypeClassification with:
 *   - archetype: always set (never null)
 *   - archetypeConfidence: 0–1 (1.0 for form-provided)
 *   - subtype: only set when confident enough (null otherwise)
 *   - subtypeConfidence: 0–1 (0 if no subtype)
 *   - evidence: classification evidence buckets
 */
export function classifyArchetype(
  formCategory: string | undefined,
  analysis: WebsiteAnalysis
): ArchetypeClassification {
  const evidence = buildEvidence(analysis);

  // ── Path 1: Form-provided category ────────────────────────────────────────
  if (formCategory?.trim()) {
    const mapped = ARCHETYPE_FORM_MAP[formCategory.trim()];
    if (mapped && mapped !== "generic_unknown") {
      const subtypeResult = classifySubtype(mapped, analysis);
      const keywordHits: string[] = [];

      // Populate evidence keyword hits from archetype keywords for transparency
      const archetypeKeywords = ARCHETYPE_KEYWORDS[mapped] ?? [];
      const allContent = [
        analysis.title ?? "",
        ...(analysis.h1Headings ?? []),
        ...(analysis.h2Headings ?? []),
        (analysis.bodyTextSample ?? "").slice(0, 400),
      ].join(" ").toLowerCase();

      for (const kw of archetypeKeywords) {
        if (allContent.includes(kw.toLowerCase())) {
          keywordHits.push(kw);
        }
      }

      return {
        archetype: mapped,
        archetypeConfidence: 1.0,
        subtype: subtypeResult?.subtype ?? null,
        subtypeConfidence: subtypeResult?.subtypeConfidence ?? 0,
        evidence: { ...evidence, keywordHits },
      };
    }
  }

  // ── Path 2: Keyword-based scoring ─────────────────────────────────────────
  if (!analysis.fetchError) {
    const archetypeScores = scoreArchetypes(analysis);

    if (archetypeScores.length > 0) {
      const best = archetypeScores[0];
      const secondBest = archetypeScores[1];

      // Require minimum raw hit count to avoid noise
      if (best.rawHitCount >= ARCHETYPE_MIN_SCORE) {
        const separation = secondBest
          ? best.normalizedScore - secondBest.normalizedScore
          : best.normalizedScore;

        // Confidence = normalizedScore × (0.5 + 0.5 × separation), cap at 0.95
        const archetypeConfidence = Math.min(
          0.95,
          best.normalizedScore * (0.5 + 0.5 * Math.min(1, separation))
        );

        const subtypeResult = classifySubtype(best.archetype, analysis);

        return {
          archetype: best.archetype,
          archetypeConfidence,
          subtype: subtypeResult?.subtype ?? null,
          subtypeConfidence: subtypeResult?.subtypeConfidence ?? 0,
          evidence: { ...evidence, keywordHits: best.keywordHits },
        };
      }
    }
  }

  // ── Path 3: Fallback ───────────────────────────────────────────────────────
  return {
    archetype: "generic_unknown",
    archetypeConfidence: 0,
    subtype: null,
    subtypeConfidence: 0,
    evidence,
  };
}
