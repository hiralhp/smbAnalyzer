"use client";

import Link from "next/link";
import type { Report } from "@/lib/types";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { ScoreBar } from "@/components/ui/ScoreBar";
import {
  impactBadgeClass,
  effortBadgeClass,
  displayUrl,
} from "@/lib/utils";
import { QueryCoverage } from "./QueryCoverage";
import { LlmCompetitorSection } from "./LlmCompetitorSection";
import { WinLossSection } from "./WinLossSection";

interface ReportCompleteProps {
  report: Report;
}

const CONTENT_ASSET_LABELS: Record<string, string> = {
  faq: "FAQ Section",
  service_page: "Service Page Outline",
  homepage_copy: "Homepage Copy",
  review_request: "Review Request Message",
  none: "Content Asset",
};

// Filter out pure SEO-structural gaps — not directly AI visibility signals
const SEO_STRUCTURAL = /\bh1\b|\bh2\b|heading count|meta description|page title|title tag|title length/i;

export function ReportComplete({ report }: ReportCompleteProps) {
  const { business, scores, scoreExplanation, findings, recommendations, llmOutput, websiteSignals, competitorSignals, queryCoverage, llmCompetitorAnalysis, discoveredCompetitors } = report;

  const gaps = findings?.filter((f) => f.type === "gap") ?? [];
  const aiGaps = gaps.filter((g) => !SEO_STRUCTURAL.test(g.label)).slice(0, 4);

  const topRecs = recommendations?.slice(0, 3) ?? [];

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
                  {(business.category || report.inferredCategory) && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
                      {business.category || report.inferredCategory}
                    </span>
                  )}
                  {(business.city || report.inferredCity) && (
                    <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                      {business.city || report.inferredCity}
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
            <div className="px-8 py-5 border-t border-slate-100">
              <p className="text-slate-600 leading-relaxed text-sm">
                {llmOutput.positioningSummary}
              </p>
            </div>
          )}
        </div>

        {/* ── Two column layout ────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column — wide */}
          <div className="lg:col-span-2 space-y-8">

            {/* PRIMARY: AI Competitor Visibility */}
            <LlmCompetitorSection
              rows={llmCompetitorAnalysis ?? []}
              businessName={business.name}
              discoveredCompetitors={discoveredCompetitors}
            />

            {/* Why You Win / Lose vs Competitors */}
            {findings && (
              <WinLossSection
                rows={llmCompetitorAnalysis ?? []}
                businessName={business.name}
                findings={findings}
                discoveredCompetitors={discoveredCompetitors}
              />
            )}

            {/* Key Gaps Affecting AI Visibility */}
            {aiGaps.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h2 className="font-semibold text-slate-900">Key gaps affecting AI visibility</h2>
                </div>
                <div className="space-y-3">
                  {aiGaps.map((g, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-2.5 h-2.5 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{g.label}</p>
                        {(g.evidence || g.detail) && (
                          <p className="text-xs text-slate-500 mt-0.5">{g.evidence ?? g.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations — top 3 */}
            {topRecs.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                    →
                  </div>
                  <h2 className="font-semibold text-slate-900">Prioritized recommendations</h2>
                </div>
                <div className="space-y-4">
                  {topRecs.map((rec, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-5 bg-white">
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
              </div>
            )}

            {/* Query coverage */}
            {queryCoverage && queryCoverage.length > 0 && (
              <QueryCoverage rows={queryCoverage} />
            )}

            {/* Content Asset */}
            {llmOutput?.contentAssetDraft && llmOutput.contentAssetType !== "none" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                    ✍
                  </div>
                  <h2 className="font-semibold text-slate-900">Recommended content: {assetLabel}</h2>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                    Ready-to-use draft · edit and publish as-is
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                    {llmOutput.contentAssetDraft}
                  </pre>
                </div>
              </div>
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
                  <ScoreBar label="Content clarity" score={scores.contentClarityScore} explanation={scoreExplanation?.contentClarity} />
                  <ScoreBar label="Service specificity" score={scores.serviceSpecificityScore} explanation={scoreExplanation?.serviceSpecificity} />
                  <ScoreBar label="Local relevance" score={scores.localRelevanceScore} explanation={scoreExplanation?.localRelevance} />
                  <ScoreBar label="Trust signals" score={scores.trustSignalScore} explanation={scoreExplanation?.trustSignals} />
                  <ScoreBar label="FAQ / Discoverability" score={scores.faqDiscoverabilityScore} explanation={scoreExplanation?.faqDiscoverability} />
                </div>
                {scoreExplanation?.overall && (
                  <p className="text-xs text-slate-400 mt-5 pt-4 border-t border-slate-100 leading-relaxed">
                    {scoreExplanation.overall}
                  </p>
                )}
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
