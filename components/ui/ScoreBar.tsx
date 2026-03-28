"use client";

import { scoreColorClass, scoreStrokeColor } from "@/lib/utils";

interface ScoreBarProps {
  label: string;
  score: number;
  description?: string;
  explanation?: string;
}

export function ScoreBar({ label, score, description, explanation }: ScoreBarProps) {
  const color = scoreStrokeColor(score);
  const tooltip = explanation ?? description;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span
          className={`text-sm font-bold ${scoreColorClass(score)}`}
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      {tooltip && (
        <p className="text-xs text-slate-400 mt-1 hidden group-hover:block leading-snug">
          {tooltip}
        </p>
      )}
    </div>
  );
}
