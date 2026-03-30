import Link from "next/link";

const features = [
  {
    icon: "🔍",
    title: "Website Signal Analysis",
    description:
      "We crawl your site and detect the exact signals AI systems use to understand your business.",
  },
  {
    icon: "📊",
    title: "AI Readiness Score",
    description:
      "Get a clear 0–100 score across content clarity, local relevance, trust signals, and more.",
  },
  {
    icon: "🎯",
    title: "Prioritized Actions",
    description:
      "Specific, ranked recommendations — not generic SEO advice — tailored to your business.",
  },
  {
    icon: "✍️",
    title: "Content Assets Included",
    description:
      "Walk away with a ready-to-use FAQ, service page outline, or homepage copy draft.",
  },
];

const metrics = [
  { value: "5 min", label: "Get your full report" },
  { value: "6 dimensions", label: "Scored across visibility, content, trust, and more" },
  { value: "100% free", label: "No signup required" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 text-sm">
              AI Visibility Report
            </span>
          </div>
          <Link
            href="/create"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Get your free report →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-brand-200">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-600 inline-block"></span>
            Free business intelligence report
          </div>

          <h1 className="text-5xl font-bold text-slate-900 leading-tight mb-6 text-balance">
            See how AI sees
            <br />
            <span className="text-brand-600">your business</span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            When someone asks ChatGPT or Perplexity to recommend a business like
            yours, are you showing up? Get a clear report on your AI
            discoverability — and exactly what to fix.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base shadow-sm"
            >
              Analyze my business
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
            </Link>
          </div>

          <p className="text-xs text-slate-400 mt-5">
            No account needed. Takes about 60 seconds.
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section className="bg-brand-600">
        <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-3 gap-6 text-center">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-3xl font-bold text-white">{m.value}</div>
              <div className="text-brand-200 text-sm mt-1">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">
              What you get
            </h2>
            <p className="text-slate-500 text-lg">
              A full picture of your AI presence in minutes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-7 border border-slate-200 shadow-sm"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to see your score?
          </h2>
          <p className="text-slate-500 mb-8 text-lg">
            Enter your business info and get a complete AI visibility report in
            under 2 minutes.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base shadow-sm"
          >
            Get my free report
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
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-slate-400">
          AI Visibility Report — Built for small businesses
        </div>
      </footer>
    </div>
  );
}
