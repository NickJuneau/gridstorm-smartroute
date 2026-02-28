import { NextResponse } from "next/server";
import { AnalyzeResult } from "@/types/analyze";

function getAnalyzeEndpoint(): string {
  const backend = process.env.BACKEND_URL?.trim() || "http://localhost:8000";
  return `${backend.replace(/\/+$/, "")}/analyze`;
}

function mockAnalyzeResult(text: string): AnalyzeResult {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return {
    cleaned_text: cleaned,
    extracted: {
      pole_id: "P-44219",
      address: "1458 Riverbend Ave",
      inspector: "Alex Rivera",
      phone: "(555) 310-7788",
      email: "alex.rivera@inspectpro.com",
      issue_type: "Transformer leak",
      details: "Observed oil leak with immediate sidewalk hazard."
    },
    interpretation: {
      urgency: "high",
      action_required: "Dispatch emergency maintenance crew",
      confidence: 0.94
    },
    routing: {
      team: "Emergency Response North",
      method: "Immediate dispatch",
      note: "Escalated due to hazard proximity and leak severity."
    },
    explainability: {
      matched_keywords: ["urgent", "leak", "hazard", "dispatch"],
      ner_tokens: ["P-44219", "1458 Riverbend Ave", "Alex Rivera"]
    },
    metadata: {
      model: "fallback-mock-v1",
      processing_time_ms: 42,
      timestamp: "2026-01-01T00:00:00.000Z",
      source: "fallback_mock"
    }
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { text?: string };
    const text = body?.text;

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Invalid request body. Provide a non-empty `text` string." },
        { status: 400 }
      );
    }

    if (process.env.FALLBACK_MOCK === "1") {
      return NextResponse.json(mockAnalyzeResult(text), { status: 200 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const upstream = await fetch(getAnalyzeEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
        cache: "no-store"
      });

      const upstreamText = await upstream.text();
      let parsed: unknown = null;
      if (upstreamText) {
        try {
          parsed = JSON.parse(upstreamText);
        } catch {
          parsed = { raw: upstreamText };
        }
      }

      if (!upstream.ok) {
        return NextResponse.json(
          {
            error: "Backend analyze endpoint returned an error.",
            details: typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed) : String(parsed ?? "")
          },
          { status: upstream.status }
        );
      }

      return NextResponse.json(parsed ?? {}, { status: 200 });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analyze route error.";
    const isAbort = error instanceof Error && error.name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort
          ? "Request timed out while contacting backend analyze service."
          : "Unable to reach backend analyze service.",
        details: message
      },
      { status: 502 }
    );
  }
}
