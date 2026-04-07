// ─────────────────────────────────────────────────────────────────────────────
// Competitor Discoverer
//
// Uses Grok to suggest 3–5 real competitors for a given business, then
// validates each domain with a HEAD request before returning results.
//
// Returns an empty array when:
// - XAI_API_KEY / GROK_API_KEY not set (getGrokProvider returns null)
// - MOCK_LLM=true
// - Grok API call fails
// - No valid domains survive HEAD validation
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmDiscoveredCompetitor, LlmProvider } from "@/lib/types";
import { getLlmProvider } from "@/lib/llm";
import { isGroqQuotaError } from "@/lib/errors";
import { buildCompetitorDiscoveryPrompt } from "@/lib/prompts/competitor-discovery";

interface DiscoveryInput {
  businessName: string;
  category: string | null;
  city: string;
  websiteUrl?: string;
  knownCompetitorDomains: string[];
}

function extractDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(
      /^www\./,
      ""
    );
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

async function validateDomain(domain: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Use Grok to discover 3–5 competitors not already in the report.
 * Each suggested domain is validated with a HEAD request before inclusion.
 */
export async function discoverCompetitorsWithGrok(
  input: DiscoveryInput,
  providerOverride?: LlmProvider
): Promise<LlmDiscoveredCompetitor[]> {
  if (process.env.MOCK_LLM === "true") return [];
  const provider = providerOverride ?? getLlmProvider();

  const { system, user } = buildCompetitorDiscoveryPrompt(input);

  let raw: string;
  try {
    raw = await provider.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 400,
      temperature: 0.2,
      jsonMode: true,
    });
  } catch (err) {
    if (isGroqQuotaError(err)) throw err;
    console.warn("[CompetitorDiscoverer] Grok call failed:", err);
    return [];
  }

  let candidates: Array<{ name: string; domain: string }>;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    candidates = parsed.filter(
      (c): c is { name: string; domain: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof c.name === "string" &&
        typeof c.domain === "string"
    );
  } catch {
    console.warn("[CompetitorDiscoverer] JSON parse failed");
    return [];
  }

  // Deduplicate against already-known competitor domains
  const knownSet = new Set(input.knownCompetitorDomains.map(extractDomain));
  const unique = candidates.filter((c) => !knownSet.has(extractDomain(c.domain)));

  // Validate domains in parallel (HEAD request, 5 s timeout each)
  const validations = await Promise.allSettled(
    unique.slice(0, 8).map(async (c) => {
      const valid = await validateDomain(c.domain);
      return valid ? c : null;
    })
  );

  return validations
    .filter(
      (r): r is PromiseFulfilledResult<LlmDiscoveredCompetitor> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value)
    .slice(0, 5);
}
