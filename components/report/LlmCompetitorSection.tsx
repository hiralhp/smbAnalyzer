"use client";

import type { LlmCompetitorAnalysisRow, CompetitorRecord } from "@/lib/types";

interface LlmCompetitorSectionProps {
  rows: LlmCompetitorAnalysisRow[];
  businessName: string;
  discoveredCompetitors?: CompetitorRecord[];
  gapExplanations?: Record<string, string>;
}

// Confidence → chip style (for competitor chips)
const CONFIDENCE_STYLES = {
  high:   { badge: "bg-violet-100 text-violet-700", label: "primary"   },
  medium: { badge: "bg-slate-100  text-slate-500",  label: "mentioned" },
  low:    { badge: "bg-slate-50   text-slate-400",  label: "brief"     },
};

// Coverage quality → pill style
const QUALITY_STYLES = {
  strong:  { cls: "bg-emerald-100 text-emerald-700", label: "Strong coverage"  },
  partial: { cls: "bg-amber-100   text-amber-700",   label: "Partial coverage" },
  weak:    { cls: "bg-red-100     text-red-600",     label: "Weak coverage"    },
};

function normName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function isTarget(name: string, businessName: string): boolean {
  const c = normName(name);
  const b = normName(businessName);
  if (c === b) return true;
  const words = b.split(/\s+/).filter((w) => w.length > 3);
  if (words.length === 0) return false;
  const matches = words.filter((w) => c.includes(w));
  return matches.length >= 2 || matches.some((w) => w.length > 7);
}

/** Fallback summary line for reports without simulatedResponse */
function getFallbackWhy(row: LlmCompetitorAnalysisRow, businessName: string): string {
  const others = row.competitors.filter((c) => !isTarget(c.name, businessName));
  if (row.targetBusinessLikelyToAppear) {
    const top = others[0];
    return top
      ? `Appearing alongside ${top.name} for this query.`
      : "Appearing in AI responses for this query.";
  }
  const top = others[0];
  if (top?.reason) {
    const reason = top.reason.charAt(0).toLowerCase() + top.reason.slice(1);
    return `${top.name} appears here because ${reason} — match that signal to compete.`;
  }
  return "Content may not be specific enough for this query.";
}

export function LlmCompetitorSection({ rows, businessName, discoveredCompetitors, gapExplanations }: LlmCompetitorSectionProps) {
  const header = (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <h2 className="font-semibold text-slate-900">AI competitor visibility</h2>
    </div>
  );

  if (!rows.length) {
    if (discoveredCompetitors?.length) {
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          {header}
          <p className="text-xs text-slate-500 mb-5 ml-10">
            Per-query simulation was unavailable. Showing likely competitors based on business type and location.
          </p>
          <div className="space-y-2">
            {discoveredCompetitors.map((c, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">{c.name}</span>
                  {c.websiteUrl && (
                    <span className="text-xs text-slate-400 truncate">{c.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
                  )}
                </div>
                {c.comparisonNote && (
                  <p className="text-xs text-slate-500 italic mt-1">{c.comparisonNote}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">Competitors inferred — full simulation requires a working LLM connection.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {header}
        <p className="text-xs text-slate-500 mb-5 ml-10">
          Simulates how an AI assistant would actually answer queries about your business.
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-5 text-center">
          <p className="text-sm text-slate-500">
            Competitor visibility simulation was not completed for this report.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            This may occur when no business name is provided or the LLM quota is exceeded.
          </p>
        </div>
      </div>
    );
  }

  const appearsCount = rows.filter((r) => r.targetBusinessLikelyToAppear).length;
  const primaryCount = rows.filter((r) => r.appearanceType === "primary").length;
  const total = rows.length;
  const hasRichData = rows.some((r) => r.simulatedResponse);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {header}
      <p className="text-xs text-slate-500 mb-5 ml-10">
        {hasRichData
          ? "Actual AI assistant responses simulated for each query — showing who appears and how."
          : "Simulated what an AI assistant would recommend for key queries about your business."}
      </p>

      {/* Summary bar */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border ${
        appearsCount === 0
          ? "bg-red-50 border-red-200"
          : appearsCount === total
          ? "bg-emerald-50 border-emerald-200"
          : "bg-amber-50 border-amber-200"
      }`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          appearsCount === 0
            ? "bg-red-100 text-red-600"
            : appearsCount === total
            ? "bg-emerald-100 text-emerald-600"
            : "bg-amber-100 text-amber-600"
        }`}>
          {appearsCount}/{total}
        </div>
        <div>
          <p className={`text-sm font-medium ${
            appearsCount === 0 ? "text-red-700" : appearsCount === total ? "text-emerald-700" : "text-amber-700"
          }`}>
            {appearsCount === 0
              ? `${businessName} did not appear in any simulated AI response`
              : appearsCount === total
              ? `${businessName} appeared in all ${total} simulated AI responses`
              : `${businessName} appeared in ${appearsCount} of ${total} simulated AI responses`}
          </p>
          {primaryCount > 0 && (
            <p className="text-xs text-emerald-600 mt-0.5">
              Top recommendation in {primaryCount} {primaryCount === 1 ? "query" : "queries"}
            </p>
          )}
        </div>
      </div>

      {/* Per-query cards */}
      <div className="space-y-3">
        {rows.map((row, i) => (
          <QueryCard key={i} row={row} businessName={businessName} gapExplanation={gapExplanations?.[row.query]} />
        ))}
      </div>
    </div>
  );
}

function AppearanceBadge({ row }: { row: LlmCompetitorAnalysisRow }) {
  const type = row.appearanceType;
  const appears = row.targetBusinessLikelyToAppear;

  if (type === "primary") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clipRule="evenodd" />
        </svg>
        Top pick
      </span>
    );
  }

  if (type === "secondary" || (!type && appears)) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Mentioned
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
      Not appearing
    </span>
  );
}

function QueryCard({
  row,
  businessName,
  gapExplanation,
}: {
  row: LlmCompetitorAnalysisRow;
  businessName: string;
  gapExplanation?: string;
}) {
  const appears = row.targetBusinessLikelyToAppear;
  const isPrimary = row.appearanceType === "primary";
  const isAbsent = row.appearanceType === "absent" || (!row.appearanceType && !appears);
  const qualityStyle = row.queryCoverageQuality ? QUALITY_STYLES[row.queryCoverageQuality] : null;

  const borderClass = isPrimary
    ? "border-emerald-200"
    : appears
    ? "border-blue-200"
    : "border-slate-200";

  const headerBgClass = isPrimary
    ? "bg-emerald-50"
    : appears
    ? "bg-blue-50"
    : "bg-slate-50";

  const otherCompetitors = row.competitors
    .filter((c) => !isTarget(c.name, businessName))
    .slice(0, 4);

  return (
    <div className={`rounded-xl border overflow-hidden ${borderClass}`}>
      {/* Query header */}
      <div className={`flex items-start justify-between gap-3 px-4 py-3 ${headerBgClass}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800">&ldquo;{row.query}&rdquo;</p>
            {qualityStyle && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${qualityStyle.cls}`}>
                {qualityStyle.label}
              </span>
            )}
          </div>

          {/* Simulated AI response — shown when available */}
          {row.simulatedResponse ? (
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed italic border-l-2 border-slate-300 pl-2">
              &ldquo;{row.simulatedResponse}&rdquo;
            </p>
          ) : (
            <p className={`text-xs mt-0.5 ${appears ? "text-blue-600" : "text-slate-500"}`}>
              {getFallbackWhy(row, businessName)}
            </p>
          )}

          {/* AI-generated gap explanation */}
          {isAbsent && gapExplanation && (
            <p className="text-xs mt-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              {gapExplanation}
            </p>
          )}
        </div>

        <AppearanceBadge row={row} />
      </div>

      {/* Competitors from the simulated response */}
      {otherCompetitors.length > 0 && (
        <div className="px-4 py-2.5 bg-white">
          <p className="text-xs text-slate-400 mb-1.5">
            {appears ? "Also in this response:" : "Mentioned instead:"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {otherCompetitors.map((c, j) => {
              const style = CONFIDENCE_STYLES[c.confidence] ?? CONFIDENCE_STYLES.medium;
              return (
                <span key={j} className="inline-flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  <span className="font-medium text-slate-700">{c.name}</span>
                  <span className={`px-1 py-0.5 rounded text-xs ${style.badge}`}>{style.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
