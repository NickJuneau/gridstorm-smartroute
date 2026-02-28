"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/utils/download";
import { SimulationResponse, SimulationResult } from "@/types/analyze";

type SimulateApiError = {
  error: string;
  details?: string;
};

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

export default function SimulatePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SimulationResponse | null>(null);

  const rows = response?.results ?? [];

  const summary = useMemo(
    () =>
      response?.summary ?? {
        processed_count: 0,
        extraction_accuracy: 0,
        routing_accuracy: 0,
        avg_processing_time_ms: 0
      },
    [response]
  );

  const runSimulation = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/simulate", { method: "GET" });
      const payload = (await res.json()) as SimulationResponse | SimulateApiError;

      if (!res.ok) {
        const message = "error" in payload ? payload.error : "Simulation failed. Please try again.";
        throw new Error(message);
      }

      setResponse(payload as SimulationResponse);
    } catch (simulateError) {
      const message = simulateError instanceof Error ? simulateError.message : "Unexpected simulation error.";
      setError(message);
    } finally {
      setIsRunning(false);
    }
  };

  const downloadResultsCsv = () => {
    const csvRows = rows.map((row) => ({
      file: row.file,
      pole_id: row.pole_id,
      issue_type: row.issue_type,
      predicted_team: row.predicted_team,
      ground_truth_team: row.ground_truth_team ?? "",
      correct: row.correct ?? "",
      urgency: row.urgency,
      time_ms: row.time_ms
    }));

    downloadCsv("simulation-results.csv", csvRows);
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Batch Simulation</h1>
            <p className="text-sm text-slate-600">Evaluate extraction and routing performance across sample files.</p>
          </div>

          <button
            type="button"
            onClick={runSimulation}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRunning ? <Spinner /> : null}
            {isRunning ? "Running..." : "Run Simulation"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="card p-4">
          <p className="label-muted">Processed Count</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.processed_count}</p>
        </article>
        <article className="card p-4">
          <p className="label-muted">Extraction Accuracy</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.extraction_accuracy.toFixed(1)}%</p>
        </article>
        <article className="card p-4">
          <p className="label-muted">Routing Accuracy</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.routing_accuracy.toFixed(1)}%</p>
        </article>
        <article className="card p-4">
          <p className="label-muted">Avg Processing Time</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.avg_processing_time_ms.toFixed(1)} ms</p>
        </article>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Simulation Results</h2>
          <button
            type="button"
            onClick={downloadResultsCsv}
            disabled={!rows.length}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["file", "pole_id", "issue_type", "predicted_team", "ground_truth_team", "correct?", "urgency", "time_ms"].map(
                  (header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {rows.length ? (
                rows.map((row: SimulationResult, index) => (
                  <tr key={`${row.file}-${index}`}>
                    <td className="px-4 py-2 text-slate-700">{row.file}</td>
                    <td className="px-4 py-2 text-slate-700">{row.pole_id}</td>
                    <td className="px-4 py-2 text-slate-700">{row.issue_type}</td>
                    <td className="px-4 py-2 text-slate-700">{row.predicted_team}</td>
                    <td className="px-4 py-2 text-slate-700">{row.ground_truth_team ?? "-"}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {typeof row.correct === "boolean" ? (row.correct ? "Yes" : "No") : "-"}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{row.urgency}</td>
                    <td className="px-4 py-2 text-slate-700">{row.time_ms}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No simulation results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
