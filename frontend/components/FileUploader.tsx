"use client";

import axios from "axios";
import { useCallback, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnalyzeResult } from "@/types/analyze";
import { normalizeAnalyzeResult } from "@/utils/normalize";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".txt", ".pdf", ".xlsx"];

type FileUploaderProps = {
  onSuccess: (result: AnalyzeResult, sourceLabel: string) => void;
  onError: (message: string) => void;
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
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function FileUploader({ onSuccess, onError }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleFileSelected = useCallback(
    (file: File | null) => {
      setLocalError(null);
      onError("");
      if (!file) {
        setSelectedFile(null);
        return;
      }
      if (!isSupportedFile(file)) {
        const msg = "Unsupported file type. Please upload .txt, .pdf, or .xlsx.";
        setLocalError(msg);
        onError(msg);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        const msg = "File exceeds 10MB limit.";
        setLocalError(msg);
        onError(msg);
        return;
      }
      setSelectedFile(file);
    },
    [onError]
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
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"]
    }
  });

  const canUpload = useMemo(() => Boolean(selectedFile) && !uploading, [selectedFile, uploading]);

  const uploadFile = async () => {
    if (!selectedFile) {
      const msg = "Please choose a file first.";
      setLocalError(msg);
      onError(msg);
      return;
    }

    setUploading(true);
    setProgress(0);
    setLocalError(null);
    onError("");
    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await axios.post("/api/analyze-file", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        signal: abortRef.current.signal,
        onUploadProgress: (event) => {
          if (!event.total) {
            return;
          }
          const pct = Math.round((event.loaded / event.total) * 100);
          setProgress(Math.min(100, Math.max(0, pct)));
        }
      });

      const normalized = normalizeAnalyzeResult(response.data);
      onSuccess(normalized, selectedFile.name);
      setProgress(100);
    } catch (error: any) {
      let message = "Failed to upload and analyze file.";
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 413) {
        message = "File exceeds 10MB limit.";
      } else if (status === 415) {
        message = "Unsupported file type. Please upload .txt, .pdf, or .xlsx.";
      } else if (status === 422) {
        message = detail ? String(detail) : "Could not process file contents.";
      } else if (detail) {
        message = String(detail);
      } else if (error?.message) {
        message = String(error.message);
      }
      setLocalError(message);
      onError(message);
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
    setUploading(false);
    setProgress(0);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setProgress(0);
    setLocalError(null);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-sm font-medium text-slate-700">Upload .txt, .pdf, .xlsx (max 10MB)</p>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-md border border-dashed p-4 text-sm transition ${
          isDragActive ? "border-primary bg-primary/5 text-primary" : "border-slate-300 bg-white text-slate-600"
        }`}
      >
        <input {...getInputProps()} />
        <p>{isDragActive ? "Drop file here..." : "Drag and drop file here, or click to browse."}</p>
      </div>

      {selectedFile ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium">{selectedFile.name}</p>
          <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
        </div>
      ) : null}

      {uploading ? (
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Uploading and analyzing... {progress}%</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={uploadFile}
          disabled={!canUpload}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Analyze Uploaded File
        </button>
        <button
          type="button"
          onClick={clearSelection}
          disabled={!selectedFile || uploading}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Remove
        </button>
        {uploading ? (
          <button
            type="button"
            onClick={cancelUpload}
            className="rounded-md border border-danger/40 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {localError ? (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{localError}</div>
      ) : null}
    </div>
  );
}
