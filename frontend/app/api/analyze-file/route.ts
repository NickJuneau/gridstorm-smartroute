import { NextResponse } from "next/server";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".pdf", ".xlsx"];

function getAnalyzeFileEndpoint(): string {
  const direct = process.env.BACKEND_URL_FILE?.trim();
  if (direct) {
    return direct;
  }
  const backend = process.env.BACKEND_URL?.trim() || "http://localhost:8000";
  return `${backend.replace(/\/+$/, "")}/analyze-file`;
}

function buildMockAnalyzeResult(fileName: string, fileSize: number) {
  return {
    clean_text: `Mock extracted text from ${fileName}`,
    extracted: {
      pole_id: "P-44219",
      permit: "PMT-1001",
      address: "1458 Riverbend Ave",
      inspector: "Demo Inspector",
      phone: "(555) 310-7788",
      email: "demo@routeiq.local",
      issue_type: "electrical",
      details: "Deterministic fallback mock from analyze-file route.",
      inspection_type: "Electrical Safety Inspection",
      result: "Failed",
      inspection_date: "2026-02-28",
      contact_name: "Demo Inspector",
      subject: "Mock Uploaded File",
      notes: "FALLBACK_MOCK=1"
    },
    interpretation: {
      urgency: "high",
      action_required: "Prioritize work order and dispatch within 24 hours",
      confidence: 0.91,
      reasons: ["mock_mode"]
    },
    routing: {
      team: "Electrical Operations",
      method: "electrical_queue",
      note: "urgent",
      matched_rule: "electrical"
    },
    explainability: {
      matched_keywords: ["urgent", "electrical"],
      ner_tokens: [],
      regex_matches: {}
    },
    metadata: {
      source: "fallback_mock_file",
      model: "fallback-mock-v1",
      processing_time_ms: 7,
      timestamp: "2026-01-01T00:00:00.000Z",
      file: {
        filename: fileName,
        size_bytes: fileSize
      }
    }
  };
}

function extensionOf(name: string): string {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf(".");
  return idx >= 0 ? lower.slice(idx) : "";
}

export async function POST(request: Request) {
  try {
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ detail: "No file uploaded. Use multipart/form-data with field 'file'." }, { status: 400 });
    }

    const ext = extensionOf(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ detail: "Unsupported file type. Allowed: .txt, .pdf, .xlsx." }, { status: 415 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ detail: "File exceeds 10MB limit" }, { status: 413 });
    }

    if (process.env.FALLBACK_MOCK === "1") {
      return NextResponse.json(buildMockAnalyzeResult(file.name, file.size), { status: 200 });
    }

    const formData = new FormData();
    formData.append("file", file, file.name);

    const upstream = await fetch(getAnalyzeFileEndpoint(), {
      method: "POST",
      body: formData,
      cache: "no-store"
    });

    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await upstream.json();
      if (!upstream.ok) {
        return NextResponse.json(
          { detail: payload?.detail ?? payload?.error ?? "File analyze request failed." },
          { status: upstream.status }
        );
      }
      return NextResponse.json(payload, { status: 200 });
    }

    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json({ detail: text || "File analyze request failed." }, { status: upstream.status });
    }
    return NextResponse.json({ detail: text }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analyze-file proxy error.";
    return NextResponse.json({ detail: `Unable to process upload: ${message}` }, { status: 502 });
  }
}
