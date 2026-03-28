"use client";

import type { FaqRow } from "@/lib/types";

interface FaqSectionProps {
  faqs: FaqRow[];
  businessName?: string;
}

export function FaqSection({ faqs, businessName }: FaqSectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center text-white text-xs font-bold">
          ?
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">
            Suggested FAQ for your business
          </h2>
          {businessName && (
            <p className="text-xs text-slate-400 mt-0.5">
              Common questions customers ask about {businessName}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="border border-slate-100 rounded-xl p-4 bg-slate-50"
          >
            <p className="text-sm font-medium text-slate-800">{faq.question}</p>
            {faq.answer ? (
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {faq.answer}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-2 italic">
                Add your answer here to help AI search engines surface your business.
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100">
        Publishing these Q&amp;As on your website signals to AI engines that you
        address common customer questions — improving discoverability.
      </p>
    </div>
  );
}
