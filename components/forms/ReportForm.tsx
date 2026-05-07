"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  websiteUrl: string;
  category: string;
  userApiKey: string;
}

export function ReportForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    websiteUrl: "",
    category: "",
    userApiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<{ reportId: string } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (e.target.name === "userApiKey") setQuotaWarning(null);
  };

  const hasUrl = form.websiteUrl.trim().length > 0;
  const canSubmit = hasUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Enter a website URL to analyze.");
      return;
    }

    setSubmitting(true);

    const payload = {
      websiteUrl: form.websiteUrl.trim() || undefined,
      category: form.category || undefined,
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

      {/* Optional: Competitors — coming soon */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">
              Competitor analysis{" "}
              <span className="text-slate-400 font-normal normal-case tracking-normal">
                — optional
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyze your site against specific competitors
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            Coming soon
          </span>
        </div>
      </div>

      {/* Enhance with AI — Groq API key */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-violet-900 text-sm">AI-powered insights</h2>
            <p className="text-xs text-violet-700 mt-0.5 leading-relaxed">
              If AI insights are unavailable, it&apos;s because the shared free tier has hit its daily limit. You can bring your own free Groq key to guarantee access — it only takes a minute to get one.
            </p>
          </div>
        </div>
        <div>
          <input
            type="password"
            name="userApiKey"
            value={form.userApiKey}
            onChange={handleChange}
            placeholder="gsk_..."
            autoComplete="new-password"
            className="w-full border border-violet-300 bg-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400 font-mono"
          />
          <p className="text-xs text-violet-600 mt-1">
            Used only for this request, never stored.{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium hover:text-violet-800"
            >
              Get a free key at console.groq.com
            </a>
          </p>
        </div>
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
        className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-base transition-colors ${
          submitting || !canSubmit
            ? "bg-brand-400 cursor-not-allowed text-white"
            : "bg-brand-600 hover:bg-brand-700 text-white shadow-sm"
        }`}
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
        Analysis takes 30–60 seconds. No account required.
      </p>
    </form>
  );
}
