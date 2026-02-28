"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
  durationMs?: number;
};

export default function Toast({ message, type = "success", onClose, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timeout);
  }, [durationMs, onClose]);

  const palette =
    type === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-ok/40 bg-ok/10 text-ok";

  return (
    <div className="fixed right-4 top-4 z-50" role="status" aria-live="polite">
      <div className={`rounded-md border px-4 py-2 text-sm font-medium shadow-sm ${palette}`}>{message}</div>
    </div>
  );
}
