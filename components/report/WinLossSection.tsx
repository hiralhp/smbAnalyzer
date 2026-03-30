"use client";

import type { LlmCompetitorAnalysisRow, Finding, CompetitorRecord } from "@/lib/types";

interface WinLossSectionProps {
  rows: LlmCompetitorAnalysisRow[];
  businessName: string;
  findings: Finding[];
  discoveredCompetitors?: CompetitorRecord[];
}

const SEO_STRUCTURAL = /\bh1\b|\bh2\b|heading count|meta description|page title|title tag|title length/i;

const AI_GAP_CONTEXT: Array<{ pattern: RegExp; context: string }> = [
  { pattern: /faq/i,                           context: "AI assistants surface FAQ content directly in answers" },
  { pattern: /review|testimonial/i,            context: "On-page reviews are a key trust signal for AI recommendations" },
  { pattern: /trust|credential|licens|certif/i, context: "Credentials help AI systems rank businesses as authoritative" },
  { pattern: /locat|city|local|address/i,       context: "Location signals determine local AI recall" },
  { pattern: /pric|rate|cost|fee/i,            context: "Clear pricing improves recall for commercial intent queries" },
  { pattern: /contact|phone|email/i,           context: "Contact info signals an active, reachable business" },
  { pattern: /service|treat|solution/i,        context: "Service-specific pages improve coverage across intent queries" },
  { pattern: /hour|open|schedul/i,             context: "Hours content affects appointment-intent queries" },
];

function getAiContext(label: string): string | null {
  for (const { pattern, context } of AI_GAP_CONTEXT) {
    if (pattern.test(label)) return context;
  }
  return null;
}

function normComp(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function aggregateCompetitors(rows: LlmCompetitorAnalysisRow[], businessName: string) {
  const bNorm = normComp(businessName);
  const bWords = bNorm.split(/\s+/).filter((w) => w.length > 3);
  const counts = new Map<string, { count: number; reason: string }>();

  for (const row of rows) {
    for (const c of row.competitors) {
      const cNorm = normComp(c.name);
      // Require 2+ word matches or one very distinctive word (>7 chars) to
      // avoid city-name false positives ("smyrna" alone ≠ same business).
      const matches = bWords.filter((w) => cNorm.includes(w));
      const isTarget = cNorm === bNorm || matches.length >= 2 || matches.some((w) => w.length > 7);
      if (isTarget) continue;
      const existing = counts.get(c.name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(c.name, { count: 1, reason: c.reason });
      }
    }
  }

  return Array.from(counts.entries())
    .map(([name, { count, reason }]) => ({ name, count, reason }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
}

export function WinLossSection({ rows, businessName, findings, discoveredCompetitors }: WinLossSectionProps) {
  const total = rows.length;
  const businessCount = rows.filter((r) => r.targetBusinessLikelyToAppear).length;
  const topCompetitors = aggregateCompetitors(rows, businessName);

  const aiGaps = findings
    .filter((f) => f.type === "gap" && !SEO_STRUCTURAL.test(f.label))
    .slice(0, 3);

  // Use discovered competitors as fallback when simulation rows are absent
  const fallbackCompetitors = !topCompetitors.length
    ? (discoveredCompetitors ?? []).slice(0, 4)
    : [];

  if (!topCompetitors.length && !fallbackCompetitors.length && !aiGaps.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-7 h-7 rounded-lg bg-rose-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
          </svg>
        </div>
        <h2 className="font-semibold text-slate-900">Why you win / lose vs competitors</h2>
      </div>

      {/* AI frequency leaderboard — full simulation data */}
      {topCompetitors.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Most frequently recommended by AI
          </p>
          <div className="space-y-2">
            {topCompetitors.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 flex-shrink-0">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{ width: `${(c.count / total) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-slate-700 flex-1">{c.name}</span>
                <span className="text-xs text-slate-400 flex-shrink-0">{c.count}/{total}</span>
              </div>
            ))}
            {/* Business row */}
            <div className="flex items-center gap-3 pt-1 border-t border-slate-100 mt-1">
              <div className="w-24 flex-shrink-0">
                <div className="h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(businessCount / total) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-emerald-700 flex-1">{businessName}</span>
              <span className="text-xs font-medium text-emerald-600 flex-shrink-0">{businessCount}/{total}</span>
            </div>
          </div>
          {topCompetitors[0] && (
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              <span className="font-medium text-slate-600">{topCompetitors[0].name}</span> appears most often
              {topCompetitors[0].reason ? ` — ${topCompetitors[0].reason.charAt(0).toLowerCase()}${topCompetitors[0].reason.slice(1)}` : ""}.
            </p>
          )}
        </div>
      )}

      {/* Fallback competitor list — when simulation unavailable but discovery ran */}
      {fallbackCompetitors.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Likely competitors in your category
          </p>
          <div className="space-y-1.5">
            {fallbackCompetitors.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
                {c.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Full per-query comparison requires a working LLM connection.</p>
        </div>
      )}

      {/* AI visibility gaps */}
      {aiGaps.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            What's costing you visibility
          </p>
          <div className="space-y-2.5">
            {aiGaps.map((g, i) => {
              const aiContext = getAiContext(g.label);
              return (
                <div key={i} className="flex gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-2 h-2 text-rose-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-slate-800">
                      {g.label}
                      {aiContext && (
                        <span className="text-slate-400"> — {aiContext}</span>
                      )}
                    </p>
                    {g.evidence && !aiContext && (
                      <p className="text-xs text-slate-500 mt-0.5">{g.evidence}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
