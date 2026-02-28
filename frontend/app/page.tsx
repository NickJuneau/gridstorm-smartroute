"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import FileUploader from "@/components/FileUploader";
import ResultCard from "@/components/ResultCard";
import SampleSelector from "@/components/SampleSelector";
import { AnalyzeApiError, AnalyzeResult } from "@/types/analyze";
import { normalizeAnalyzeResult } from "@/utils/normalize";

type HistoryItem = {
  id: string;
  text: string;
  result: AnalyzeResult;
  createdAt: string;
};

export default function HomePage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const appendHistory = (sourceText: string, data: AnalyzeResult) => {
    const nextItem: HistoryItem = {
      id: `${Date.now()}`,
      text: sourceText,
      result: data,
      createdAt: new Date().toLocaleString()
    };
    setHistory((prev) => [nextItem, ...prev].slice(0, 5));
  };

  const handleAnalyze = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!text.trim()) {
      setError("Please enter or upload email text before analyzing.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      const payload = (await response.json()) as AnalyzeResult | AnalyzeApiError;

      if (!response.ok) {
        const message = "error" in payload ? payload.error : "Unable to complete analysis right now.";
        throw new Error(message);
      }

      const data = normalizeAnalyzeResult(payload);
      setResult(data);
      appendHistory(text, data);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unexpected error during analysis.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadText = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== "text/plain" && !file.name.toLowerCase().endsWith(".txt")) {
      setError("Only .txt files are supported for direct textarea insert.");
      return;
    }

    const fileText = await file.text();
    setText(fileText);
    setError(null);
  };

  const handleClear = () => {
    setText("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SmartRoute Analyzer</h1>
          <p className="mt-1 text-sm text-slate-600">
            Parse inspector emails, classify urgency, and get routing recommendations instantly.
          </p>

          <form onSubmit={handleAnalyze} suppressHydrationWarning className="mt-5 space-y-4">
            <label htmlFor="email-body" className="label-muted block">
              Inspector Email Input
            </label>
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
            <p id="email-help" className="text-xs text-slate-500">
              Supports plain text field notes and copied email content.
            </p>

            <SampleSelector onInsert={setText} />

            <div className="rounded-lg border border-dashed border-slate-300 p-3">
              <label htmlFor="txt-upload" className="label-muted block">
                Quick .txt to textarea (optional)
              </label>
              <input
                id="txt-upload"
                type="file"
                accept=".txt,text/plain"
                onChange={handleUploadText}
                className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>

            <FileUploader
              onError={(message) => setError(message || null)}
              onSuccess={(uploadedResult, sourceLabel) => {
                setResult(uploadedResult);
                setError(null);
                appendHistory(`[file] ${sourceLabel}`, uploadedResult);
              }}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Analyzing..." : "Analyze"}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <ResultCard result={result} />
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Recent History</h2>
        <p className="mt-1 text-sm text-slate-500">Last 5 analyses. Click an item to repopulate the editor.</p>

        {history.length ? (
          <ul className="mt-4 space-y-2">
            {history.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setText(item.text);
                    setResult(item.result);
                    setError(null);
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-primary/50 hover:bg-slate-50"
                >
                  <p className="truncate text-sm font-medium text-slate-800">{item.result.extracted.issue_type || "Unknown issue"}</p>
                  <p className="truncate text-xs text-slate-500">
                    {item.result.extracted.pole_id || "No pole ID"} - {item.createdAt}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No analysis history yet.</p>
        )}
      </section>
    </div>
  );
}
