"use client";

import { ReactNode, useMemo } from "react";
import { AnalyzeResult } from "@/types/analyze";
import { downloadJson } from "@/utils/download";

type ResultCardProps = {
  result: AnalyzeResult | null;
};

function urgencyBadgeClass(urgency: string): string {
  if (urgency === "high") {
    return "bg-danger/15 text-danger";
  }
  if (urgency === "medium") {
    return "bg-warn/25 text-slate-800";
  }
  return "bg-ok/15 text-ok";
}

function highlightKeywords(text: string, keywords: string[]): ReactNode {
  if (!keywords.length || !text.trim()) {
    return text;
  }

  const escaped = keywords
    .filter((keyword) => keyword.trim().length > 0)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  if (!escaped.length) {
    return text;
  }

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const chunks = text.split(regex);

  return (
    <>
      {chunks.map((chunk, idx) => {
        const isMatch = keywords.some((keyword) => keyword.toLowerCase() === chunk.toLowerCase());
        return isMatch ? (
          <mark key={`${chunk}-${idx}`} className="rounded bg-primary/20 px-1 text-slate-900">
            {chunk}
          </mark>
        ) : (
          <span key={`${chunk}-${idx}`}>{chunk}</span>
        );
      })}
    </>
  );
}

export default function ResultCard({ result }: ResultCardProps) {
  const content = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      ...result,
      interpretation: {
        ...result.interpretation,
        confidencePercent: `${Math.round(result.interpretation.confidence * 100)}%`
      }
    };
  }, [result]);

  if (!content) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Result</h2>
        <p className="text-sm text-slate-500">Run an analysis to see extraction, routing, and explainability details.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Result</h2>
        <button
          type="button"
          onClick={() => downloadJson("analysis-result.json", content)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Download JSON
        </button>
      </div>

      <details className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3" open>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Cleaned Text</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {highlightKeywords(content.cleaned_text, content.explainability.matched_keywords)}
        </p>
      </details>

      <div className="mb-4 rounded-md border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Extraction</h3>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Pole ID</dt>
            <dd className="font-medium text-slate-900">{content.extracted.pole_id || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium text-slate-900">{content.extracted.address || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Inspector</dt>
            <dd className="font-medium text-slate-900">{content.extracted.inspector || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium text-slate-900">{content.extracted.phone || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{content.extracted.email || "-"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Issue Type</dt>
            <dd className="font-medium text-slate-900">{content.extracted.issue_type || "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Details</dt>
            <dd className="font-medium text-slate-900">{content.extracted.details || "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-4 rounded-md border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Interpretation</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-1 font-medium ${urgencyBadgeClass(content.interpretation.urgency)}`}>
            {content.interpretation.urgency.toUpperCase()}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Action: {content.interpretation.action_required}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
            Confidence: {content.interpretation.confidencePercent}
          </span>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Routing</h3>
        <p className="text-sm text-slate-800">
          <span className="font-semibold">Team:</span> {content.routing.team}
        </p>
        <p className="text-sm text-slate-800">
          <span className="font-semibold">Method:</span> {content.routing.method}
        </p>
        <p className="text-sm text-slate-700">{content.routing.note}</p>
      </div>

      <div className="mb-4 rounded-md border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Explainability</h3>
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Matched Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {content.explainability.matched_keywords.length ? (
              content.explainability.matched_keywords.map((keyword) => (
                <span key={keyword} className="rounded bg-primary/15 px-2 py-1 text-xs text-primary">
                  {keyword}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No keywords found.</span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">NER Tokens</p>
          <div className="flex flex-wrap gap-1.5">
            {content.explainability.ner_tokens.length ? (
              content.explainability.ner_tokens.map((token) => (
                <span key={token} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {token}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">No NER tokens found.</span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        title="Export PDF not implemented"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500"
      >
        Export PDF
      </button>
    </section>
  );
}
