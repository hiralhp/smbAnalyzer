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
  city: string;
  topServices: string;
  competitorUrls: string;
}

export function ReportForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    websiteUrl: "",
    category: "",
    city: "",
    topServices: "",
    competitorUrls: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.websiteUrl.trim()) {
      setError("Website URL is required.");
      return;
    }

    setSubmitting(true);

    const payload = {
      websiteUrl: form.websiteUrl.trim(),
      category: form.category || undefined,
      city: form.city.trim() || undefined,
      topServices: form.topServices
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      competitorUrls: form.competitorUrls
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
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

      const { reportId } = (await res.json()) as { reportId: string };
      router.push(`/report/${reportId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Required fields */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-slate-900 text-sm uppercase tracking-wider">
          Business details
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Website URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            name="websiteUrl"
            value={form.websiteUrl}
            onChange={handleChange}
            placeholder="https://yourwebsite.com"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400"
            required
          />
          <p className="text-xs text-slate-400 mt-1">
            We&apos;ll analyze your site and extract your business name automatically.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Business category
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
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              City / Location
            </label>
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Top services
          </label>
          <input
            type="text"
            name="topServices"
            value={form.topServices}
            onChange={handleChange}
            placeholder="e.g. AC Repair, Furnace Installation, Duct Cleaning"
            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-400 mt-1">
            Comma-separated. Helps us check how well your services are
            positioned.
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
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-semibold text-base transition-colors",
          submitting
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
