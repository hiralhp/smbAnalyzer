"use client";

import Link from "next/link";
import type { Report } from "@/lib/types";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { Badge } from "@/components/ui/Badge";
import {
  impactBadgeClass,
  effortBadgeClass,
  displayUrl,
} from "@/lib/utils";
import { CompetitorComparison } from "./CompetitorComparison";

interface ReportCompleteProps {
  report: Report;
}

const SIGNAL_LABELS: Record<string, string> = {
  hasServicePages: "Service pages",
  hasFaq: "FAQ section",
  hasLocationMention: "Location signals",
  hasTrustSignals: "Trust credentials",
  hasContactInfo: "Contact information",
  hasHours: "Business hours",
  hasPricing: "Pricing language",
  hasTestimonials: "Customer reviews",
};

const CONTENT_ASSET_LABELS: Record<string, string> = {
  faq: "FAQ Section",
  service_page: "Service Page Outline",
  homepage_copy: "Homepage Copy",
  review_request: "Review Request Message",
  none: "Content Asset",
};

export function ReportComplete({ report }: ReportCompleteProps) {
  const { business, scores, findings, recommendations, llmOutput, websiteSignals, competitorSignals } = report;

  const strengths = findings?.filter((f) => f.type === "strength") ?? [];
  const gaps = findings?.filter((f) => f.type === "gap") ?? [];

  const assetLabel = llmOutput?.contentAssetType
    ? CONTENT_ASSET_LABELS[llmOutput.contentAssetType] ?? "Content Asset"
    : "Content Asset";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-slate-900">AI Visibility Report</span>
          </Link>
          <Link
            href="/create"
            className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            New report
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Report Header ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-brand-200 text-sm font-medium mb-1">
                  AI Visibility Report
                </p>
                <h1 className="text-3xl font-bold text-white mb-3">
                  {business.name}
                </h1>
                <div className="flex flex-wrap gap-2">
                  {business.category && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                      {business.category}
                    </span>
                  )}
                  {business.city && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {business.city}
                    </span>
                  )}
                  {business.websiteUrl && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                      {displayUrl(business.websiteUrl)}
                    </span>
                  )}
                </div>
              </div>
              {scores && (
                <div className="flex-shrink-0 text-center">
                  <ScoreRing
                    score={scores.overallScore}
                    size={100}
                    strokeWidth={7}
                    labelClassName="text-white"
                  />
                  <p className="text-brand-200 text-xs mt-1">AI Readiness</p>
                </div>
              )}
            </div>
          </div>

          {/* Positioning summary */}
          {llmOutput?.positioningSummary && (
            <div className="px-8 py-6 border-t border-slate-100">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Current Positioning
              </h2>
              <p className="text-slate-700 leading-relaxed">
                {llmOutput.positioningSummary}
              </p>
            </div>
          )}
        </div>

        {/* ── Two column layout ────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column — wide */}
          <div className="lg:col-span-2 space-y-8">

            {/* Strengths */}
            {strengths.length > 0 && (
              <Section title="Strengths detected" icon="✓" iconBg="bg-emerald-500">
                <div className="space-y-3">
                  {strengths.map((s, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{s.label}</p>
                        {s.detail && <p className="text-xs text-slate-500 mt-0.5">{s.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Gaps */}
            {gaps.length > 0 && (
              <Section title="Opportunities" icon="!" iconBg="bg-amber-500">
                <div className="space-y-3">
                  {gaps.map((g, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{g.label}</p>
                        {g.detail && <p className="text-xs text-slate-500 mt-0.5">{g.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Recommendations */}
            {recommendations && recommendations.length > 0 && (
              <Section title="Prioritized recommendations" icon="→" iconBg="bg-brand-600">
                <div className="space-y-4">
                  {recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="border border-slate-200 rounded-xl p-5 bg-white"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {rec.priority}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-sm mb-1">
                            {rec.title}
                          </h3>
                          <p className="text-slate-600 text-sm leading-relaxed">
                            {rec.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 ml-9">
                        {rec.impact && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${impactBadgeClass(rec.impact)}`}>
                            {rec.impact} impact
                          </span>
                        )}
                        {rec.effort && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${effortBadgeClass(rec.effort)}`}>
                            {rec.effort} effort
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Competitor comparison */}
            {websiteSignals && competitorSignals && competitorSignals.length > 0 && (
              <CompetitorComparison you={websiteSignals} competitors={competitorSignals} />
            )}

            {/* Content Asset */}
            {llmOutput?.contentAssetDraft && llmOutput.contentAssetType !== "none" && (
              <Section title={`Recommended content: ${assetLabel}`} icon="✍" iconBg="bg-purple-600">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                    Ready-to-use draft · edit and publish as-is
                  </p>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                      {llmOutput.contentAssetDraft}
                    </pre>
                  </div>
                </div>
              </Section>
            )}
          </div>

          {/* Right column — sidebar */}
          <div className="space-y-6">

            {/* Score breakdown */}
            {scores && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
                  Score breakdown
                </h2>
                <div className="space-y-5">
                  <ScoreBar label="Content clarity" score={scores.contentClarityScore} />
                  <ScoreBar label="Service specificity" score={scores.serviceSpecificityScore} />
                  <ScoreBar label="Local relevance" score={scores.localRelevanceScore} />
                  <ScoreBar label="Trust signals" score={scores.trustSignalScore} />
                  <ScoreBar label="FAQ / Discoverability" score={scores.faqDiscoverabilityScore} />
                </div>
              </div>
            )}

            {/* Website signals */}
            {websiteSignals && !websiteSignals.fetchError && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">
                  Website signals
                </h2>

                {/* Meta info */}
                {(websiteSignals.title || websiteSignals.metaDescription) && (
                  <div className="mb-4 pb-4 border-b border-slate-100 space-y-2">
                    {websiteSignals.title && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Title</p>
                        <p className="text-xs text-slate-700 mt-0.5 leading-snug">
                          {websiteSignals.title}
                        </p>
                      </div>
                    )}
                    {websiteSignals.metaDescription && (
                      <div>
                        <p className="text-xs text-slate-400 font-medium">Meta description</p>
                        <p className="text-xs text-slate-700 mt-0.5 leading-snug line-clamp-2">
                          {websiteSignals.metaDescription}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Signal checklist */}
                <div className="grid grid-cols-1 gap-2">
                  {(
                    Object.entries(SIGNAL_LABELS) as [
                      keyof typeof websiteSignals,
                      string
                    ][]
                  ).map(([key, label]) => {
                    const value = websiteSignals[key as keyof typeof websiteSignals];
                    const detected = value === true;
                    return (
                      <div key={key} className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                            detected ? "bg-emerald-100" : "bg-slate-100"
                          }`}
                        >
                          {detected ? (
                            <svg className="w-2.5 h-2.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-2 h-2 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            detected ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {websiteSignals?.fetchError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-medium text-amber-700 mb-1">Website unavailable</p>
                <p className="text-xs text-amber-600">{websiteSignals.fetchError}</p>
              </div>
            )}

            {/* LLM model info */}
            {llmOutput?.modelUsed && llmOutput.modelUsed !== "seed-mock" && (
              <div className="text-center">
                <p className="text-xs text-slate-300">
                  Insights by {llmOutput.modelUsed}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="bg-brand-600 rounded-2xl p-8 text-center">
          <h2 className="text-white font-bold text-xl mb-2">
            Want another business analyzed?
          </h2>
          <p className="text-brand-200 text-sm mb-5">
            Each report is free and takes about 60 seconds.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-brand-700 font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Create another report
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

      </main>
    </div>
  );
}

// ── Helper component ──────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  iconBg,
  children,
}: {
  title: string;
  icon: string;
  iconBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center text-white text-xs font-bold`}
        >
          {icon}
        </div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
