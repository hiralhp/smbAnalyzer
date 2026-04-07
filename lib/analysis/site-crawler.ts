// ─────────────────────────────────────────────────────────────────────────────
// Site Crawler
//
// Fetches a small set of high-value sub-pages (services, faq, about, contact)
// and merges their content into the homepage WebsiteAnalysis. This gives the
// query-coverage and scoring layers richer evidence without a full site crawl.
//
// Reuses scrapeWebsite() from scraper.ts. Each sub-page fetch is capped at
// 5 s via Promise.race so one slow page can't block the whole pipeline.
// All fetches run in parallel via Promise.allSettled.
// ─────────────────────────────────────────────────────────────────────────────

import { scrapeWebsite } from "@/lib/analysis/scraper";
import type { WebsiteAnalysis } from "@/lib/types";

const SUB_PAGE_TIMEOUT_MS = 5_000;
const MAX_SUB_PAGES = 6;
const BODY_TEXT_APPEND_CHARS = 500;
const BODY_TEXT_CAP_CHARS = 4_000;

// Path scoring: higher score = more likely to contain useful evidence
function scoreLink(url: string): number {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  if (/\/(services?|solutions?|offerings?|work|what-we-do)\b/.test(path)) return 2;
  if (/\/(faq|questions?|help|support)\b/.test(path)) return 2;
  if (/\/about\b/.test(path)) return 2;
  if (/\/contact\b/.test(path)) return 2;
  if (/\/pric(ing|e)\b/.test(path)) return 1;
  if (/\/reviews?\b/.test(path)) return 1;
  return 0;
}

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
  );
}

/**
 * Crawl up to MAX_SUB_PAGES high-value internal links from the homepage
 * analysis and merge their content into a single enriched WebsiteAnalysis.
 *
 * Returns `{ merged, pagesScanned }` where `pagesScanned` = 1 (homepage) +
 * the number of successfully fetched sub-pages.
 *
 * Never throws — any sub-page failure is silently ignored.
 */
export async function crawlSiteForEvidence(
  homepage: WebsiteAnalysis
): Promise<{ merged: WebsiteAnalysis; pagesScanned: number }> {
  // Score and pick top sub-pages
  const candidates = homepage.internalLinks
    .filter((link) => scoreLink(link) > 0)
    .map((link) => ({ link, score: scoreLink(link) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUB_PAGES)
    .map((c) => c.link);

  if (candidates.length === 0) {
    return { merged: homepage, pagesScanned: 1 };
  }

  // Fetch all candidates in parallel, each with a 5 s timeout
  const results = await Promise.allSettled(
    candidates.map((url) =>
      Promise.race([
        scrapeWebsite(url, { isCompetitor: false }),
        timeoutAfter(SUB_PAGE_TIMEOUT_MS),
      ])
    )
  );

  // Collect successful sub-page analyses
  const subPages: WebsiteAnalysis[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && !r.value.fetchError) {
      subPages.push(r.value);
    }
  }

  if (subPages.length === 0) {
    return { merged: homepage, pagesScanned: 1 };
  }

  // ── Merge sub-page signals into homepage ──────────────────────────────────
  const merged: WebsiteAnalysis = { ...homepage };

  // Boolean flags: OR across all pages
  merged.hasServicePages = homepage.hasServicePages || subPages.some((p) => p.hasServicePages);
  merged.hasFaq          = homepage.hasFaq          || subPages.some((p) => p.hasFaq);
  merged.hasLocationMention = homepage.hasLocationMention || subPages.some((p) => p.hasLocationMention);
  merged.hasTrustSignals = homepage.hasTrustSignals || subPages.some((p) => p.hasTrustSignals);
  merged.hasContactInfo  = homepage.hasContactInfo  || subPages.some((p) => p.hasContactInfo);
  merged.hasHours        = homepage.hasHours        || subPages.some((p) => p.hasHours);
  merged.hasPricing      = homepage.hasPricing      || subPages.some((p) => p.hasPricing);
  merged.hasTestimonials = homepage.hasTestimonials || subPages.some((p) => p.hasTestimonials);
  merged.mentionsIntegrations = homepage.mentionsIntegrations || subPages.some((p) => p.mentionsIntegrations);
  merged.mentionsAppointments = homepage.mentionsAppointments || subPages.some((p) => p.mentionsAppointments);
  merged.mentionsRoomsOrStays = homepage.mentionsRoomsOrStays || subPages.some((p) => p.mentionsRoomsOrStays);
  merged.mentionsContentOrBlog = homepage.mentionsContentOrBlog || subPages.some((p) => p.mentionsContentOrBlog);

  // bodyTextSample: append up to BODY_TEXT_APPEND_CHARS per sub-page, capped at total
  let combinedBody = homepage.bodyTextSample ?? "";
  for (const page of subPages) {
    if (combinedBody.length >= BODY_TEXT_CAP_CHARS) break;
    const snippet = (page.bodyTextSample ?? "").slice(0, BODY_TEXT_APPEND_CHARS);
    if (snippet) combinedBody += " " + snippet;
  }
  merged.bodyTextSample = combinedBody.slice(0, BODY_TEXT_CAP_CHARS);

  // h2Headings: union from all pages (deduplicated)
  const h2Set = new Set<string>(homepage.h2Headings);
  for (const page of subPages) {
    for (const h2 of page.h2Headings) {
      h2Set.add(h2);
    }
  }
  merged.h2Headings = Array.from(h2Set);

  return { merged, pagesScanned: 1 + subPages.length };
}
