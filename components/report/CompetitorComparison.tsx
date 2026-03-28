import type { WebsiteSignalSummary, CompetitorSignalSummary } from "@/lib/types";
import { displayUrl } from "@/lib/utils";

interface CompetitorComparisonProps {
  you: WebsiteSignalSummary;
  competitors: CompetitorSignalSummary[];
}

const SIGNALS: Array<{ key: keyof CompetitorSignalSummary; label: string }> = [
  { key: "hasFaq", label: "FAQ section" },
  { key: "hasServicePages", label: "Service pages" },
  { key: "hasContactInfo", label: "Contact information" },
  { key: "hasTrustSignals", label: "Trust credentials" },
  { key: "hasTestimonials", label: "Customer reviews" },
  { key: "hasLocationMention", label: "Location signals" },
  { key: "hasHours", label: "Business hours" },
  { key: "hasPricing", label: "Pricing language" },
];

function Check({ on }: { on: boolean }) {
  if (on) {
    return (
      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
      <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

export function CompetitorComparison({ you, competitors }: CompetitorComparisonProps) {
  // Count signals where competitors beat you
  const gaps = SIGNALS.filter(({ key }) => {
    const youHave = you[key as keyof WebsiteSignalSummary] === true;
    const anyCompHas = competitors.some((c) => c[key] === true);
    return !youHave && anyCompHas;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white text-xs font-bold">
          ⚡
        </div>
        <h2 className="font-semibold text-slate-900">Competitor comparison</h2>
      </div>

      {gaps.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Competitors are ahead on <strong>{gaps.length} signal{gaps.length > 1 ? "s" : ""}</strong>:{" "}
          {gaps.map((g) => g.label).join(", ")}.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-slate-400 font-medium pb-3 pr-4 w-40">Signal</th>
              <th className="text-center text-slate-700 font-semibold pb-3 px-3 min-w-[64px]">
                You
              </th>
              {competitors.map((c, i) => (
                <th key={i} className="text-center pb-3 px-3 min-w-[80px]">
                  <div className="font-semibold text-slate-700 truncate max-w-[80px] mx-auto" title={c.name}>
                    {c.name}
                  </div>
                  <div className="text-slate-400 font-normal truncate max-w-[80px] mx-auto" title={c.url}>
                    {displayUrl(c.url)}
                  </div>
                  {c.fetchError && (
                    <div className="text-amber-500 font-normal">unavailable</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIGNALS.map(({ key, label }) => {
              const youHave = you[key as keyof WebsiteSignalSummary] === true;
              const anyCompBeatsYou = !youHave && competitors.some((c) => c[key] === true);
              return (
                <tr
                  key={key}
                  className={`border-b border-slate-50 last:border-0 ${anyCompBeatsYou ? "bg-amber-50/40" : ""}`}
                >
                  <td className={`py-2.5 pr-4 font-medium ${anyCompBeatsYou ? "text-amber-700" : "text-slate-600"}`}>
                    {label}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Check on={youHave} />
                  </td>
                  {competitors.map((c, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {c.fetchError ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <Check on={c[key] === true} />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
