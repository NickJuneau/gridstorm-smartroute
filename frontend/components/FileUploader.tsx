"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnalyzeResult } from "@/types/analyze";
import { normalizeAnalyzeResult } from "@/utils/normalize";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type FileUploaderProps = {
  onFileAnalyzed: (result: AnalyzeResult) => void;
  onSelect?: (file: File | null) => void;
  existingFile?: File | null;
  onError?: (message: string) => void;
  onToast?: (message: string, type?: "success" | "error") => void;
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

function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith(".txt") || lower.endsWith(".pdf") || lower.endsWith(".xlsx");
}

export default function FileUploader({ onFileAnalyzed, onSelect, existingFile, onError, onToast }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(existingFile ?? null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSelectedFile(existingFile ?? null);
  }, [existingFile]);

  const handleFileSelected = useCallback(
    (file: File | null) => {
      setLocalError(null);
      onError?.("");
      if (!file) {
        setSelectedFile(null);
        onSelect?.(null);
        return;
      }
      if (!isSupportedFile(file)) {
        const message = "Unsupported file type. Please upload .txt, .pdf, or .xlsx.";
        setLocalError(message);
        onError?.(message);
        onToast?.(message, "error");
        setSelectedFile(null);
        onSelect?.(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        const message = "File exceeds 10MB limit";
        setLocalError(message);
        onError?.(message);
        onToast?.(message, "error");
        setSelectedFile(file);
        onSelect?.(file);
        return;
      }
      setSelectedFile(file);
      onSelect?.(file);
    },
    [onError, onSelect, onToast]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      handleFileSelected(acceptedFiles[0] ?? null);
    },
    [handleFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: uploading,
    accept: { "application/octet-stream": [".txt", ".pdf", ".xlsx"] }
  });

  const fileTooLarge = Boolean(selectedFile && selectedFile.size > MAX_FILE_SIZE);
  const canUpload = useMemo(() => Boolean(selectedFile) && !uploading && !fileTooLarge, [selectedFile, uploading, fileTooLarge]);

  const uploadFile = async () => {
    if (!selectedFile) {
      const message = "Please choose a file first.";
      setLocalError(message);
      onError?.(message);
      onToast?.(message, "error");
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      const message = "File exceeds 10MB limit";
      setLocalError(message);
      onError?.(message);
      onToast?.(message, "error");
      return;
    }

    setUploading(true);
    setProgress(0);
    setLocalError(null);
    onError?.("");
    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      setProgress(35);
      const response = await fetch("/api/analyze-file", {
        method: "POST",
        body: formData,
        signal: abortRef.current.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw { response: { status: response.status, data: payload } };
      }
      setProgress(90);
      const normalized = normalizeAnalyzeResult(payload);
      onFileAnalyzed(normalized);
      onToast?.("File analyzed", "success");
      setProgress(100);
    } catch (error: any) {
      const status = Number(error?.response?.status ?? 0);
      const detail = error?.response?.data?.detail;
      let message = "Failed to upload and analyze file.";

      if (status === 413) {
        message = "File exceeds 10MB limit";
      } else if (status === 415) {
        message = "Unsupported file type. Please upload .txt, .pdf, or .xlsx.";
      } else if (status === 422) {
        message = typeof detail === "string" ? detail : "Could not process file contents.";
      } else if (detail) {
        message = typeof detail === "string" ? detail : JSON.stringify(detail);
      } else if (error?.message) {
        message = String(error.message);
      }

      setLocalError(message);
      onError?.(message);
      onToast?.(message, "error");
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setProgress(0);
    setLocalError(null);
    onSelect?.(null);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="file-upload-input">
        File Upload
      </label>
      <div
        {...getRootProps()}
        tabIndex={0}
        className={`rounded-md border border-dashed p-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          isDragActive ? "border-primary bg-primary/5 text-primary" : "border-slate-300 bg-white text-slate-600"
        }`}
      >
        <input id="file-upload-input" {...getInputProps({ accept: ".txt,.pdf,.xlsx" })} aria-label="Upload file" />
        <p>Drag and drop file here, or click to browse. Accepts .txt, .pdf, .xlsx (max 10MB)</p>
      </div>

      {selectedFile ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <p className="font-medium text-slate-800">{selectedFile.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
        </div>
      ) : null}

      {(uploading || progress > 0) && selectedFile ? (
        <div className="mt-3">
          <div className="h-2 w-full rounded bg-slate-200">
            <div className="h-2 rounded bg-slate-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Upload progress: {progress}%</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={uploadFile}
          disabled={!canUpload}
          aria-label="Analyze uploaded file"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? "Uploading..." : "Analyze Uploaded File"}
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={!selectedFile || uploading}
          aria-label="Remove selected file"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove
        </button>
      </div>

      {(localError || fileTooLarge) && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {fileTooLarge ? "File exceeds 10MB limit" : localError}
        </div>
      )}
    </div>
  );
}
