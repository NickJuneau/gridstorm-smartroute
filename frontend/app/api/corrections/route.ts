import { NextResponse } from "next/server";

function getCorrectionsEndpoint(): string {
  const direct = process.env.BACKEND_URL_CORRECTIONS?.trim();
  if (direct) {
    return direct;
  }
  return "http://localhost:8000/corrections";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (process.env.FALLBACK_MOCK === "1") {
      return NextResponse.json({ ok: true });
    }

    const upstream = await fetch(getCorrectionsEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const text = await upstream.text();
    let payload: unknown = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { detail: text || "Unexpected backend response." };
    }

    if (!upstream.ok) {
      return NextResponse.json(payload, { status: upstream.status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown corrections proxy error.";
    return NextResponse.json({ detail: `Corrections proxy failed: ${message}` }, { status: 500 });
  }
}
