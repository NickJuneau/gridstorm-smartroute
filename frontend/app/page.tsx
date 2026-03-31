"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import FileUploader from "@/components/FileUploader";
import ResultCard from "@/components/ResultCard";
import SampleSelector from "@/components/SampleSelector";
import Toast from "@/components/Toast";
import { AnalyzeApiError, AnalyzeResult } from "@/types/analyze";
import { downloadJson } from "@/utils/download";
import { normalizeAnalyzeResult } from "@/utils/normalize";

type HistoryItem = {
  id: string;
  text: string;
  result: AnalyzeResult;
  createdAt: string;
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

const HISTORY_KEY = "smartroute-history-v1";

function urgencyDotClass(urgency: string): string {
  const value = urgency.toLowerCase();
  if (value === "emergency") return "bg-danger";
  if (value === "high") return "bg-orange-500";
  if (value === "medium") return "bg-warn";
  return "bg-ok";
}

function shortId(result: AnalyzeResult, fallbackId: string): string {
  const raw = result.message_id || fallbackId;
  return raw.slice(-6);
}

export default function HomePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [fileResults, setFileResults] = useState<AnalyzeResult[]>([]);
  const [selectedFileResultIndex, setSelectedFileResultIndex] = useState(0);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as HistoryItem[];
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 5));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
  }, [history]);

  const appendHistory = (sourceText: string, data: AnalyzeResult) => {
    const item: HistoryItem = {
      id: `${Date.now()}`,
      text: sourceText,
      result: data,
      createdAt: new Date().toLocaleString()
    };
    setHistory((prev) => [item, ...prev].slice(0, 5));
  };

  const clearTransientError = () => setError(null);

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    clearTransientError();

    if (!text.trim()) {
      const message = "Please enter or upload email text before analyzing.";
      setError(message);
      setToast({ message, type: "error" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const payload = (await response.json()) as AnalyzeResult | AnalyzeApiError;
      if (!response.ok) {
        const message = "error" in payload ? payload.error : "Unable to complete analysis right now.";
        throw new Error(message);
      }
      const normalized = normalizeAnalyzeResult(payload);
      setResult(normalized);
      appendHistory(text, normalized);
      setToast({ message: "Analysis complete", type: "success" });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error during analysis.";
      setError(message);
      setToast({ message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadText = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".txt")) {
      const message = "Only .txt files are supported for direct textarea insert.";
      setError(message);
      setToast({ message, type: "error" });
      return;
    }
    const fileText = await file.text();
    setText(fileText);
    clearTransientError();
  };

  const handleClear = () => {
    setText("");
    setResult(null);
    setFileResults([]);
    setSelectedFileResultIndex(0);
    clearTransientError();
  };

  const historyPills = useMemo(
    () =>
      history.map((item) => ({
        ...item,
        urgency: item.result.interpretation?.urgency ?? "low",
        route: item.result.routing?.team ?? "Field Services",
        shortId: shortId(item.result, item.id)
      })),
    [history]
  );

  return (
    <div className="space-y-6">
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SmartRoute Analyzer</h1>
          <p className="mt-1 text-sm text-slate-600">Parse inspector emails, classify urgency, and get routing recommendations instantly.</p>

          <form onSubmit={handleAnalyze} suppressHydrationWarning className="mt-5 space-y-4">
            <label htmlFor="email-body" className="label-muted block">Inspector Email Input</label>
            <textarea
              id="email-body"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={14}
              suppressHydrationWarning
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Paste inspector email text here..."
              aria-describedby="email-help"
            />
            <p id="email-help" className="text-xs text-slate-500">Supports plain text field notes and copied email content.</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                aria-label="Analyze text"
                disabled={isLoading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Analyzing..." : "Analyze"}
              </button>
              <button
                type="button"
                aria-label="Clear analysis form"
                onClick={handleClear}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>

            <SampleSelector onInsert={setText} />

            {/* Removed for now. Not needed for CTO demo */}
            {/* <div className="rounded-lg border border-dashed border-slate-300 p-3">
              <label htmlFor="txt-upload" className="label-muted block">Quick .txt to textarea (optional)</label>
              <input
                id="txt-upload"
                type="file"
                accept=".txt,text/plain"
                onChange={handleUploadText}
                className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div> */}
            

            <FileUploader
              onError={(message) => setError(message || null)}
              onFileResults={(results) => {
                setFileResults(results);
                setSelectedFileResultIndex(0);
                const first = results[0] ?? null;
                setResult(first);
                if (first) {
                  appendHistory(first.raw_text || "[uploaded file]", first);
                }
              }}
            />
          </form>

          {error ? <div className="mt-4 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</div> : null}
        </div>

        <div className="space-y-4">
          {fileResults.length ? (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Uploaded Rows</h3>
                <button
                  type="button"
                  aria-label="Export all upload results JSON"
                  onClick={() => downloadJson("upload-results.json", fileResults)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Export All JSON
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto">
                {fileResults.map((item, index) => {
                  const permit = (item.extracted.permit_number || item.extracted.permit || "-").toString();
                  const urgency = item.interpretation?.urgency || "low";
                  const confidencePct = Math.round((item.interpretation?.confidence ?? 0.8) * 100);
                  const rowIndex = Number(item.metadata?.row_index ?? index);
                  return (
                    <button
                      key={`${rowIndex}-${item.message_id || index}`}
                      type="button"
                      aria-label={`Select uploaded result row ${rowIndex}`}
                      onClick={() => {
                        setSelectedFileResultIndex(index);
                        setResult(item);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                        selectedFileResultIndex === index
                          ? "border-primary bg-primary/5"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">#{rowIndex}</span>
                        <span className="text-slate-700">{permit}</span>
                        <span className={`h-2 w-2 rounded-full ${urgencyDotClass(urgency)}`} />
                        <span className="text-xs text-slate-500">{confidencePct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <ResultCard result={result} onToast={(message, type = "success") => setToast({ message, type })} />
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Recent History</h2>
        <p className="mt-1 text-sm text-slate-500">Last 5 analyses. Click a pill to reload the result and input text.</p>

        {historyPills.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {historyPills.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-label={`Load history item ${item.shortId}`}
                onClick={() => {
                  setText(item.result.raw_text || item.text || "");
                  setResult(item.result);
                  clearTransientError();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary/40 hover:bg-slate-50"
              >
                <span>{item.shortId}</span>
                <span className={`h-2 w-2 rounded-full ${urgencyDotClass(item.urgency)}`} />
                <span>{item.route}</span>
                <span className="text-slate-500">{item.createdAt}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No analysis history yet.</p>
        )}
      </section>
    </div>
  );
}
