"use client";

import type { QueryCoverageRow } from "@/lib/types";

interface QueryCoverageProps {
  rows: QueryCoverageRow[];
}

const COVERAGE_CONFIG = {
  strong: {
    label: "Strong",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  partial: {
    label: "Partial",
    bg: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-400",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
  weak: {
    label: "Weak",
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-400",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
  },
};

export function QueryCoverage({ rows }: QueryCoverageProps) {
  if (!rows.length) return null;

  const strong = rows.filter((r) => r.coverage === "strong").length;
  const partial = rows.filter((r) => r.coverage === "partial").length;
  const weak = rows.filter((r) => r.coverage === "weak").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          Q
        </div>
        <h2 className="font-semibold text-slate-900">Query coverage</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5 ml-10">
        How well your site covers likely search queries AI systems process.
      </p>

      {/* Summary bar */}
      <div className="flex gap-3 mb-5 text-xs">
        <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          {strong} strong
        </span>
        <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          {partial} partial
        </span>
        <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
          {weak} weak
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => {
          const cfg = COVERAGE_CONFIG[row.coverage];
          return (
            <div
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bg} ${cfg.border}`}
            >
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-slate-800 font-medium">
                    &ldquo;{row.query}&rdquo;
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                {row.missingTerms.length > 0 && (
                  <p className="text-xs text-slate-500 mt-1">
                    Missing:{" "}
                    <span className="font-medium text-slate-600">
                      {row.missingTerms.join(", ")}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
