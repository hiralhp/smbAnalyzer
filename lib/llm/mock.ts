// ─────────────────────────────────────────────────────────────────────────────
// Mock LLM provider — returns deterministic fake responses for development
// Enable by setting MOCK_LLM=true in .env.local
// ─────────────────────────────────────────────────────────────────────────────

import type { LlmCallOptions, LlmProvider } from "@/lib/types";
import type { LlmReportSummary } from "@/lib/types";

const MOCK_SUMMARY: LlmReportSummary = {
  positioningSummary:
    "This business has a functional web presence with basic local information, but lacks the structured, AI-readable content that helps AI assistants confidently recommend it. Key opportunities exist in FAQ content, dedicated service pages, and embedded trust signals.",
  topStrengths: [
    "Business name and location are clearly communicated",
    "Core services are mentioned, giving AI systems a starting point",
    "Contact information is present and accessible",
  ],
  topOpportunities: [
    "No FAQ section means AI cannot surface direct answers about your services",
    "Individual service pages would dramatically improve discoverability",
    "Customer review content is absent from the site itself",
  ],
  contentAssetType: "faq",
  contentAssetDraft: `## Frequently Asked Questions

**What services do you offer?**
We provide a full range of professional services tailored to meet your needs. Contact us for a detailed overview.

**What areas do you serve?**
We serve the local area and surrounding communities. Call us to confirm service availability in your location.

**How do I get started?**
Simply contact us by phone or through our website form. We'll schedule a consultation at your convenience.

**What makes you different from competitors?**
We combine local expertise with personalized service. Our team has deep roots in this community and a track record customers trust.

**Do you offer free estimates?**
Yes, we provide free no-obligation estimates for most services. Reach out to schedule yours.`,
};

export class MockProvider implements LlmProvider {
  async complete(_options: LlmCallOptions): Promise<string> {
    // Simulate a short network delay
    await new Promise((r) => setTimeout(r, 300));
    return JSON.stringify(MOCK_SUMMARY);
  }
}
