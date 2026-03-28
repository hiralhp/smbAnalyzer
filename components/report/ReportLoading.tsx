"use client";

import Link from "next/link";

const STEPS = [
  { label: "Fetching your website", minPoll: 0 },
  { label: "Extracting content signals", minPoll: 2 },
  { label: "Running AI readiness scoring", minPoll: 5 },
  { label: "Generating insights and recommendations", minPoll: 8 },
  { label: "Drafting your content asset", minPoll: 12 },
];

interface ReportLoadingProps {
  businessName?: string;
  status: "pending" | "running";
  pollCount: number;
}

export function ReportLoading({ businessName, status, pollCount }: ReportLoadingProps) {
  const activeStep = STEPS.findLastIndex((s) => pollCount >= s.minPoll);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-slate-900">AI Visibility Report</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-md w-full text-center">
          {/* Animated icon */}
          <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-brand-100">
            <svg
              className="w-9 h-9 text-brand-600 animate-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {status === "pending"
              ? "Preparing your report..."
              : `Analyzing ${businessName ?? "your business"}...`}
          </h1>
          <p className="text-slate-500 mb-10 text-sm">
            This usually takes 30–60 seconds. Hang tight.
          </p>

          {/* Progress steps */}
          <div className="text-left space-y-3 mb-10">
            {STEPS.map((step, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              const pending = i > activeStep;

              return (
                <div key={step.label} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      done
                        ? "bg-emerald-500"
                        : active
                        ? "bg-brand-600"
                        : "bg-slate-200"
                    }`}
                  >
                    {done ? (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : active ? (
                      <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : null}
                  </div>
                  <span
                    className={`text-sm transition-colors ${
                      done
                        ? "text-slate-500 line-through"
                        : active
                        ? "text-slate-900 font-medium"
                        : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pulsing bar */}
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-1000"
              style={{
                width: `${Math.min(
                  ((activeStep + 1) / STEPS.length) * 90,
                  90
                )}%`,
              }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Page will update automatically
          </p>
        </div>
      </div>
    </div>
  );
}
