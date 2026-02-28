"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AnalyzeResult } from "@/types/analyze";
import { downloadJson } from "@/utils/download";

type ResultCardProps = {
  result: AnalyzeResult | null;
  onToast?: (message: string, type?: "success" | "error") => void;
};

type CorrectionForm = {
  permit_number: string;
  address: string;
  inspection_type: string;
  inspector: string;
};

function urgencyBadgeClass(urgency: string): string {
  const normalized = urgency.toLowerCase();
  if (normalized === "emergency") {
    return "bg-danger text-white";
  }
  if (normalized === "high") {
    return "bg-orange-500 text-white";
  }
  if (normalized === "medium") {
    return "bg-warn text-slate-900";
  }
  return "bg-ok text-white";
}

function progressClass(confidence: number): string {
  if (confidence < 0.4) {
    return "bg-danger";
  }
  if (confidence < 0.6) {
    return "bg-warn";
  }
  return "bg-ok";
}

function renderHighlightedText(text: string, token: string | null, markRef: React.RefObject<HTMLSpanElement | null>): ReactNode {
  if (!token || !token.trim()) {
    return text;
  }
  const safeText = text ?? "";
  const tokenIndex = safeText.toLowerCase().indexOf(token.toLowerCase());
  if (tokenIndex < 0) {
    return safeText;
  }

  const before = safeText.slice(0, tokenIndex);
  const match = safeText.slice(tokenIndex, tokenIndex + token.length);
  const after = safeText.slice(tokenIndex + token.length);

  return (
    <>
      {before}
      <span ref={markRef} className="rounded bg-yellow-200 px-1 text-slate-900">
        {match}
      </span>
      {after}
    </>
  );
}

function regexHint(result: AnalyzeResult, field: string): string {
  const mapping = result.explainability?.regex_matches;
  const patterns = mapping?.[field];
  if (Array.isArray(patterns) && patterns.length) {
    return patterns.join(" | ");
  }
  return "extracted via regex";
}

export default function ResultCard({ result, onToast }: ResultCardProps) {
  const markRef = useRef<HTMLSpanElement | null>(null);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [isCorrectionPanelOpen, setIsCorrectionPanelOpen] = useState(true);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [isCorrectionSaved, setIsCorrectionSaved] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState<CorrectionForm>({
    permit_number: "",
    address: "",
    inspection_type: "",
    inspector: ""
  });

  const content = useMemo(() => {
    if (!result) {
      return null;
    }
    const confidenceValue = Number(result.interpretation?.confidence);
    const confidence = Number.isFinite(confidenceValue) ? Math.max(0, Math.min(1, confidenceValue)) : 0.8;
    const confidencePercent = Math.round(confidence * 100);

    return {
      ...result,
      interpretation: {
        ...result.interpretation,
        confidence,
        confidencePercent
      }
    };
  }, [result]);

  const lowConfidence = (content?.interpretation.confidence ?? 0.8) < 0.6;

  useEffect(() => {
    if (markRef.current) {
      markRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeToken]);

  useEffect(() => {
    if (!content) {
      return;
    }
    setIsCorrectionPanelOpen((content.interpretation.confidence ?? 0.8) < 0.6);
    setIsCorrectionSaved(false);
    setCorrectionError(null);
    setCorrectionForm({
      permit_number: String(content.extracted.permit_number ?? content.extracted.permit ?? ""),
      address: String(content.extracted.address ?? ""),
      inspection_type: String(content.extracted.inspection_type ?? content.extracted.issue_type ?? ""),
      inspector: String(content.extracted.inspector ?? "")
    });
  }, [content?.message_id, content?.raw_text]);

  if (!content) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Result</h2>
        <p className="text-sm text-slate-500">Run an analysis to see extraction, routing, and explainability details.</p>
      </section>
    );
  }

  const handleSaveCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCorrectionError(null);

    if (!correctionForm.permit_number.trim() || !correctionForm.address.trim() || !correctionForm.inspection_type.trim() || !correctionForm.inspector.trim()) {
      const message = "All correction fields are required.";
      setCorrectionError(message);
      onToast?.(message, "error");
      return;
    }

    setIsSavingCorrection(true);
    try {
      const response = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_text: content.raw_text ?? content.cleaned_text,
          corrected: correctionForm,
          source: content.metadata?.file?.filename || "ui"
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(String(payload?.detail ?? "Failed to save correction."));
      }

      setIsCorrectionSaved(true);
      onToast?.("Correction saved", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save correction.";
      setCorrectionError(message);
      onToast?.(message, "error");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-live="polite">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Result</h2>
        <button
          type="button"
          onClick={() => downloadJson("analysis-result.json", content)}
          aria-label="Download analysis JSON"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Download JSON
        </button>
      </div>

      <div className="mb-4 rounded-md border border-slate-200 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Interpretation</h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide ${urgencyBadgeClass(content.interpretation.urgency)}`}>
            {content.interpretation.urgency}
          </span>
          <div className="min-w-[180px] flex-1">
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Confidence: {content.interpretation.confidencePercent}%
            </span>
            <div className="mt-2 h-1 w-full rounded bg-slate-200">
              <div
                className={`h-1 rounded ${progressClass(content.interpretation.confidence)}`}
                style={{ width: `${content.interpretation.confidencePercent}%` }}
              />
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-700">Action: {content.interpretation.action_required}</p>
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
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Extraction</h3>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Permit</dt>
            <dd className="font-medium text-slate-900">
              {content.extracted.permit_number || content.extracted.permit || "-"}
              <span className="ml-2 cursor-help text-xs text-slate-400" title={regexHint(content, "permit")}>?</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Pole ID</dt>
            <dd className="font-medium text-slate-900">
              {content.extracted.pole_id || "-"}
              <span className="ml-2 cursor-help text-xs text-slate-400" title={regexHint(content, "pole_id")}>?</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Address</dt>
            <dd className="font-medium text-slate-900">
              {content.extracted.address || "-"}
              <span className="ml-2 cursor-help text-xs text-slate-400" title={regexHint(content, "address")}>?</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Inspector</dt>
            <dd className="font-medium text-slate-900">
              {content.extracted.inspector || "-"}
              <span className="ml-2 cursor-help text-xs text-slate-400" title={regexHint(content, "inspector")}>?</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Issue Type</dt>
            <dd className="font-medium text-slate-900">
              {content.extracted.issue_type || content.extracted.inspection_type || "-"}
              <span className="ml-2 cursor-help text-xs text-slate-400" title={regexHint(content, "inspection_type")}>?</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium text-slate-900">{content.extracted.phone || "-"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Details</dt>
            <dd className="font-medium text-slate-900">{content.extracted.details || "-"}</dd>
          </div>
        </dl>
      </div>

      <details className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3" open>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Cleaned Text</summary>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{renderHighlightedText(content.cleaned_text, activeToken, markRef)}</p>
      </details>

      <div className="mb-4 rounded-md border border-slate-200 p-3">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Explainability</h3>
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Matched Keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {content.explainability.matched_keywords.length ? (
              content.explainability.matched_keywords.map((keyword, index) => (
                <button
                  key={`${keyword}-${index}`}
                  type="button"
                  aria-label={`Highlight keyword ${keyword}`}
                  onClick={() => setActiveToken(keyword)}
                  className="rounded bg-primary/15 px-2 py-1 text-xs text-primary transition hover:bg-primary/25 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {keyword}
                </button>
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
              content.explainability.ner_tokens.map((token, index) => (
                <button
                  key={`${token}-${index}`}
                  type="button"
                  aria-label={`Highlight token ${token}`}
                  onClick={() => setActiveToken(token.replace(/\s*\([^)]*\)$/, ""))}
                  className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 transition hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {token}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-500">No NER tokens found.</span>
            )}
          </div>
        </div>
      </div>

      {lowConfidence ? (
        <details className="mb-4 rounded-md border border-warn/40 bg-warn/10 p-3" open={isCorrectionPanelOpen}>
          <summary
            className="cursor-pointer text-sm font-semibold text-slate-800"
            onClick={(event) => {
              event.preventDefault();
              setIsCorrectionPanelOpen((prev) => !prev);
            }}
          >
            Review & correct
          </summary>

          {isCorrectionPanelOpen ? (
            <form onSubmit={handleSaveCorrection} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="corr-permit" className="mb-1 block text-xs font-medium text-slate-600">
                  Permit
                </label>
                <input
                  id="corr-permit"
                  aria-label="Permit correction"
                  value={correctionForm.permit_number}
                  disabled={isCorrectionSaved}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, permit_number: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="corr-address" className="mb-1 block text-xs font-medium text-slate-600">
                  Address
                </label>
                <input
                  id="corr-address"
                  aria-label="Address correction"
                  value={correctionForm.address}
                  disabled={isCorrectionSaved}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, address: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="corr-inspection-type" className="mb-1 block text-xs font-medium text-slate-600">
                  Inspection Type
                </label>
                <input
                  id="corr-inspection-type"
                  aria-label="Inspection type correction"
                  value={correctionForm.inspection_type}
                  disabled={isCorrectionSaved}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, inspection_type: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="corr-inspector" className="mb-1 block text-xs font-medium text-slate-600">
                  Inspector
                </label>
                <input
                  id="corr-inspector"
                  aria-label="Inspector correction"
                  value={correctionForm.inspector}
                  disabled={isCorrectionSaved}
                  onChange={(event) => setCorrectionForm((prev) => ({ ...prev, inspector: event.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <button
                  type="submit"
                  aria-label="Save correction"
                  disabled={isSavingCorrection || isCorrectionSaved}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingCorrection ? "Saving..." : isCorrectionSaved ? "Saved" : "Save correction"}
                </button>
                <button
                  type="button"
                  aria-label="Cancel correction edits"
                  onClick={() => {
                    setCorrectionForm({
                      permit_number: String(content.extracted.permit_number ?? content.extracted.permit ?? ""),
                      address: String(content.extracted.address ?? ""),
                      inspection_type: String(content.extracted.inspection_type ?? content.extracted.issue_type ?? ""),
                      inspector: String(content.extracted.inspector ?? "")
                    });
                    setCorrectionError(null);
                  }}
                  disabled={isSavingCorrection}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>

              {correctionError ? <p className="sm:col-span-2 text-sm text-danger">{correctionError}</p> : null}
            </form>
          ) : null}
        </details>
      ) : null}

      <button
        type="button"
        title="Export PDF not implemented"
        aria-label="Export PDF"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500"
      >
        Export PDF
      </button>
    </section>
  );
}
