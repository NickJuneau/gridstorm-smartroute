import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function backendUrl(): string {
  return process.env.BACKEND_URL_FILE || "http://localhost:8000/analyze-file";
}

function mockResult() {
  return {
    message_id: "mock-file-001",
    raw_text: "Mock raw text",
    clean_text: "Mock raw text",
    extracted: {
      pole_id: "P-44219",
      permit: "PMT-1001",
      address: "1458 Riverbend Ave",
      inspection_type: "Electrical Safety Inspection",
      result: "Failed",
      inspection_date: "2026-02-28",
      inspector: "Demo Inspector",
      contact_name: "Demo Inspector",
      phone: "(555) 310-7788",
      email: "inspector@example.com",
      issue_type: "electrical",
      details: "Mock file analyze response",
      subject: "Mock",
      notes: "FALLBACK_MOCK=1"
    },
    interpretation: {
      action_required: "Dispatch field team",
      urgency: "high",
      confidence: 0.88,
      reasons: ["mock_mode"]
    },
    routing: {
      team: "Field Services",
      method: "field_queue",
      note: "urgent",
      matched_rule: "default"
    },
    explainability: {
      matched_keywords: ["urgent"],
      ner_tokens: [],
      regex_matches: {}
    },
    metadata: {
      processing_time_ms: 2,
      model: "fallback-mock-v1",
      spacy_enabled: false,
      timestamp: "2026-01-01T00:00:00Z"
    }
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ detail: "No file uploaded. Use multipart/form-data with field 'file'." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ detail: "File exceeds 10MB limit" }, { status: 413 });
    }

    if (process.env.FALLBACK_MOCK === "1") {
      return NextResponse.json({
        file: { filename: file.name, size_bytes: file.size },
        results: [mockResult()]
      });
    }

    const upstream = await fetch(backendUrl(), {
      method: "POST",
      body: formData,
      cache: "no-store"
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") || "application/json" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy error.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}
