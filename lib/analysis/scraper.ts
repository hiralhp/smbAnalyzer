// ─────────────────────────────────────────────────────────────────────────────
// Website Scraper
//
// Fetches a URL and extracts structured signals using cheerio (HTML parsing).
// No headless browser — lightweight and fast for MVP.
//
// TODO: For JS-heavy SPAs, consider adding a Puppeteer/Playwright fallback
//       behind a feature flag or separate worker endpoint.
// ─────────────────────────────────────────────────────────────────────────────

import * as cheerio from "cheerio";
import type { WebsiteAnalysis } from "@/lib/types";

const FETCH_TIMEOUT_MS = 15_000;
const BODY_TEXT_MAX_CHARS = 2_000;

// Keywords used in heuristic signal detection
const FAQ_KEYWORDS = ["faq", "frequently asked", "common questions", "q&a", "questions & answers"];
const TRUST_KEYWORDS = ["certified", "licensed", "insured", "award", "accredited", "guarantee", "warranty", "bbb", "years of experience", "family owned"];
const PRICING_KEYWORDS = ["price", "pricing", "cost", "rate", "fee", "quote", "estimate", "starting at", "$", "free"];
const TESTIMONIAL_KEYWORDS = ["testimonial", "review", "what our customers", "what clients say", "5 star", "★", "⭐"];
const HOURS_KEYWORDS = ["monday", "tuesday", "hours", "open", "closed", "am", "pm", "24/7", "24 hours"];
const CONTACT_PATTERNS = [
  /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/,   // (555) 555-5555
  /\d{3}[-.\s]\d{3}[-.\s]\d{4}/,    // 555-555-5555
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,    // email
];

/** Normalize a URL — adds https:// if no scheme is present */
function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Empty URL");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Extract the base origin from a URL for relative link resolution */
function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Scrape a URL and return a structured WebsiteAnalysis.
 * Never throws — errors are captured in the `fetchError` field.
 */
export async function scrapeWebsite(
  url: string,
  options: { isCompetitor?: boolean; competitorName?: string } = {}
): Promise<WebsiteAnalysis> {
  const base: WebsiteAnalysis = {
    url,
    isCompetitor: options.isCompetitor ?? false,
    competitorName: options.competitorName,
    h1Headings: [],
    h2Headings: [],
    internalLinks: [],
    hasServicePages: false,
    hasFaq: false,
    hasLocationMention: false,
    hasTrustSignals: false,
    hasContactInfo: false,
    hasHours: false,
    hasPricing: false,
    hasTestimonials: false,
  };

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch (e) {
    return { ...base, fetchError: `Invalid URL: ${url}` };
  }

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AIVisibilityBot/1.0; +https://aivisibility.report)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { ...base, fetchError: `HTTP ${res.status} ${res.statusText}` };
    }
    html = await res.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, fetchError: `Fetch failed: ${msg}` };
  }

  // ── Parse HTML ──────────────────────────────────────────────────────────────
  const $ = cheerio.load(html);
  const origin = getOrigin(normalizedUrl);

  // Remove noisy elements before text extraction
  $("script, style, noscript, nav, footer, [aria-hidden='true']").remove();

  const title = $("title").first().text().trim() || undefined;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || undefined;

  const h1Headings = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h2Headings = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 10);

  // Extract body text sample for LLM context
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const bodyTextSample = bodyText.slice(0, BODY_TEXT_MAX_CHARS);

  // ── Internal links ──────────────────────────────────────────────────────────
  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (href.startsWith("/") || href.startsWith(origin)) {
      const normalized = href.startsWith("/") ? `${origin}${href}` : href;
      if (!internalLinks.includes(normalized)) {
        internalLinks.push(normalized);
      }
    }
  });

  // ── Signal detection ────────────────────────────────────────────────────────
  const fullText = (
    (title ?? "") +
    " " +
    (metaDescription ?? "") +
    " " +
    h1Headings.join(" ") +
    " " +
    h2Headings.join(" ") +
    " " +
    bodyTextSample
  ).toLowerCase();

  // Service pages: internal links with service-y path segments
  const serviceLinkPatterns = ["service", "solution", "offering", "work", "what-we-do", "products"];
  const hasServicePages =
    internalLinks.some((link) =>
      serviceLinkPatterns.some((p) => link.toLowerCase().includes(p))
    ) ||
    h2Headings.some((h) =>
      serviceLinkPatterns.some((p) => h.toLowerCase().includes(p))
    );

  const hasFaq = containsAny(fullText, FAQ_KEYWORDS);
  const hasTrustSignals = containsAny(fullText, TRUST_KEYWORDS);
  const hasPricing = containsAny(fullText, PRICING_KEYWORDS);
  const hasTestimonials = containsAny(fullText, TESTIMONIAL_KEYWORDS);
  const hasHours = containsAny(fullText, HOURS_KEYWORDS);
  const hasContactInfo = matchesAny(bodyText, CONTACT_PATTERNS);

  // Location: check if city/location words appear in prominent positions
  // We'll use a simple heuristic — check title + H1 for location language
  const prominentText = [title, ...(h1Headings ?? [])].join(" ").toLowerCase();
  const hasLocationMention =
    /\b[a-z]{3,},\s*[a-z]{2}\b/.test(prominentText) || // "city, ST" pattern
    containsAny(prominentText, ["serving", "located in", "based in", "near"]);

  return {
    url: normalizedUrl,
    isCompetitor: options.isCompetitor ?? false,
    competitorName: options.competitorName,
    title,
    metaDescription,
    h1Headings,
    h2Headings,
    bodyTextSample,
    hasServicePages,
    hasFaq,
    hasLocationMention,
    hasTrustSignals,
    hasContactInfo,
    hasHours,
    hasPricing,
    hasTestimonials,
    internalLinks: internalLinks.slice(0, 20), // cap for storage
  };
}
