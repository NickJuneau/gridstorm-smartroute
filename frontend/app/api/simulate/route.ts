import { NextResponse } from "next/server";
import { SimulationResponse } from "@/types/analyze";

function getSimulateEndpoint(): string {
  const backend = process.env.BACKEND_URL_SIM?.trim() || process.env.BACKEND_URL?.trim() || "http://localhost:8000";
  return `${backend.replace(/\/+$/, "")}/simulate`;
}

function mockSimulation(): SimulationResponse {
  return {
    summary: {
      processed_count: 3,
      extraction_accuracy: 93.3,
      routing_accuracy: 100,
      avg_processing_time_ms: 31.7
    },
    results: [
      {
        file: "email_001.txt",
        pole_id: "P-44219",
        issue_type: "Transformer leak",
        predicted_team: "Emergency Response North",
        ground_truth_team: "Emergency Response North",
        correct: true,
        urgency: "high",
        time_ms: 29
      },
      {
        file: "email_002.txt",
        pole_id: "P-88910",
        issue_type: "Vegetation encroachment",
        predicted_team: "Vegetation Crew West",
        ground_truth_team: "Vegetation Crew West",
        correct: true,
        urgency: "medium",
        time_ms: 35
      },
      {
        file: "email_003.txt",
        pole_id: "P-12004",
        issue_type: "Crossarm damage",
        predicted_team: "Structural Repair Team",
        ground_truth_team: "Structural Repair Team",
        correct: true,
        urgency: "high",
        time_ms: 31
      }
    ]
  };
}

export async function GET() {
  try {
    if (process.env.FALLBACK_MOCK === "1") {
      return NextResponse.json(mockSimulation(), { status: 200 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const upstream = await fetch(getSimulateEndpoint(), {
        method: "GET",
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
            error: "Backend simulate endpoint returned an error.",
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
    const message = error instanceof Error ? error.message : "Unknown simulate route error.";
    const isAbort = error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        error: isAbort
          ? "Request timed out while contacting backend simulation service."
          : "Unable to reach backend simulation service.",
        details: message
      },
      { status: 502 }
    );
  }
}
