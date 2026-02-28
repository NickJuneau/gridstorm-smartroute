"use client";

import { useState } from "react";
import { AnalyzeResult } from "@/types/analyze";
import { normalizeAnalyzeResult } from "@/utils/normalize";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type FileUploaderProps = {
  onFileResults: (results: AnalyzeResult[]) => void;
  onError?: (message: string) => void;
};

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileUploader({ onFileResults, onError }: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (selected: File | null) => {
    setError(null);
    onError?.("");
    setFile(selected);
    if (selected && selected.size > MAX_FILE_SIZE) {
      const message = "File exceeds 10MB limit";
      setError(message);
      onError?.(message);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      const message = "File exceeds 10MB limit";
      setError(message);
      onError?.(message);
      return;
    }

    setIsUploading(true);
    setError(null);
    onError?.("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/analyze-file", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = String(payload?.detail ?? "Upload failed.");
        throw new Error(message);
      }

      const incomingResults: unknown[] = Array.isArray(payload?.results)
        ? payload.results
        : payload
          ? [payload]
          : [];
      const normalized = incomingResults.map((item) => normalizeAnalyzeResult(item));
      onFileResults(normalized);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
      onError?.(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label htmlFor="upload-file" className="mb-2 block text-sm font-medium text-slate-700">
        Upload file
      </label>
      <input
        id="upload-file"
        type="file"
        accept=".txt,.pdf,.xlsx"
        aria-label="Upload .txt, .pdf, or .xlsx"
        onChange={(event) => handleSelect(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700"
      />

      {file ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <p className="font-medium">{file.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          aria-label="Analyze uploaded file"
          disabled={!file || isUploading || file.size > MAX_FILE_SIZE}
          onClick={handleUpload}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Analyze Uploaded File"}
        </button>
        <button
          type="button"
          aria-label="Remove selected file"
          disabled={!file || isUploading}
          onClick={() => handleSelect(null)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove
        </button>
      </div>

      {error ? (
        <p className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
    </div>
  );
}
