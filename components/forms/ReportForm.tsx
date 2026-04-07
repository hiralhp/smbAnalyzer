"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "HVAC / Home Services",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Landscaping / Lawn Care",
  "Cleaning Services",
  "Pest Control",
  "Auto Repair",
  "Dentist / Dental Practice",
  "Medical / Healthcare",
  "Legal / Law Firm",
  "Accounting / Financial",
  "Real Estate",
  "Hotel / Hospitality",
  "Restaurant / Food",
  "Retail",
  "Fitness / Gym",
  "Salon / Beauty",
  "Pet Services",
  "Childcare / Education",
  "Other",
];

interface FormState {
  businessName: string;
  websiteUrl: string;
  category: string;
  city: string;
  competitorUrls: string;
  userApiKey: string;
}

export function ReportForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    businessName: "",
    websiteUrl: "",
    category: "",
    city: "",
    competitorUrls: "",
    userApiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState<{ reportId: string } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === "userApiKey") setQuotaWarning(null);
  };

  const hasUrl = form.websiteUrl.trim().length > 0;
  const hasNameAndCity =
    form.businessName.trim().length > 0 && form.city.trim().length > 0;
  const canSubmit = hasUrl || hasNameAndCity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError(
        "Enter a website URL, or provide both a business name and city."
      );
      return;
    }

    setSubmitting(true);

    const payload = {
      businessName: form.businessName.trim() || undefined,
      websiteUrl: form.websiteUrl.trim() || undefined,
      category: form.category || undefined,
      city: form.city.trim() || undefined,
      competitorUrls: form.competitorUrls
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      userApiKey: form.userApiKey.trim() || undefined,
    };

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create report.");
      }

      const { reportId, needsPersonalGroqKey } = (await res.json()) as {
        reportId: string;
        needsPersonalGroqKey?: boolean;
      };

      if (needsPersonalGroqKey) {
        setQuotaWarning({ reportId });
        setShowOptional(true);
        setSubmitting(false);
        return;
      }

      router.push(`/report/${reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Required fields */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">
          Business details
        </h2>

        {/* Option 1: Website URL */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Website URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="websiteUrl"
            value={form.websiteUrl}
            onChange={handleChange}
            placeholder="yourwebsite.com"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-400 mt-1">
            We&apos;ll analyze your site and extract signals automatically.
          </p>
        </div>

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Option 2: Name + City */}
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">
            Business name &amp; city <span className="text-red-500">*</span>
            <span className="text-slate-400 font-normal ml-1">(if no website)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              placeholder="e.g. Blue Ridge HVAC"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400"
            />
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="e.g. Denver, CO"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Category — optional */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Business category{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-slate-700 bg-white"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Helps us generate more accurate recommendations.
          </p>
        </div>
      </div>

      {/* Optional: Competitors */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={() => setShowOptional(!showOptional)}
        >
          <div>
            <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider text-left">
              Competitor analysis{" "}
              <span className="text-slate-400 font-normal normal-case tracking-normal">
                — optional
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 text-left">
              Compare your site against competitors
            </p>
          </div>
          <svg
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform flex-shrink-0",
              showOptional ? "rotate-180" : ""
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {showOptional && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Competitor URLs
              </label>
              <textarea
                name="competitorUrls"
                value={form.competitorUrls}
                onChange={handleChange}
                placeholder={"https://competitor1.com\nhttps://competitor2.com"}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400 resize-none font-mono text-xs"
              />
              <p className="text-xs text-slate-400 mt-1">One URL per line. Names are extracted automatically.</p>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Groq API key{" "}
                <span className="text-slate-400 font-normal">(if the free tier is busy)</span>
              </label>
              <input
                type="password"
                name="userApiKey"
                value={form.userApiKey}
                onChange={handleChange}
                placeholder="gsk_..."
                autoComplete="off"
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">
                Used only for this request and never stored.{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate-600"
                >
                  Get a free key at console.groq.com
                </a>
              </p>
            </div>
          </div>
        )}
      </div>

      {quotaWarning && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Shared API limit reached
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            Due to high traffic, the shared Groq key hit its free-tier limit. Your report was still generated using our deterministic analysis — but the AI-written summary and enhancements were skipped.
          </p>
          <p className="text-sm text-amber-800 leading-relaxed">
            To get the full AI-enhanced report, add your own free Groq API key below and re-submit. It takes about 30 seconds to{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-amber-900"
            >
              create one at console.groq.com
            </a>
            .
          </p>
          <a
            href={`/report/${quotaWarning.reportId}`}
            className="inline-block text-xs text-amber-700 underline hover:text-amber-900 mt-1"
          >
            View your report anyway (AI features limited)
          </a>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-base transition-colors",
          submitting || !canSubmit
            ? "bg-brand-400 cursor-not-allowed text-white"
            : "bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
        )}
      >
        {submitting ? (
          <>
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Creating your report...
          </>
        ) : (
          <>
            Generate my AI Visibility Report
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-400">
        Analysis takes about 30–60 seconds. No account required.
      </p>
    </form>
  );
}
