import { AnalyzeResult } from "@/types/analyze";

export function normalizeAnalyzeResult(payload: unknown): AnalyzeResult {
  const source = (payload ?? {}) as Record<string, any>;
  const extracted = (source.extracted ?? {}) as Record<string, any>;
  const interpretation = (source.interpretation ?? {}) as Record<string, any>;
  const routing = (source.routing ?? {}) as Record<string, any>;
  const explainability = (source.explainability ?? {}) as Record<string, any>;
  const metadata = (source.metadata ?? {}) as Record<string, any>;
  const confidenceRaw = Number(interpretation.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? confidenceRaw : 0.8;
  const regexMatchesRaw = explainability.regex_matches;
  const regexMatches =
    regexMatchesRaw && typeof regexMatchesRaw === "object" && !Array.isArray(regexMatchesRaw)
      ? Object.fromEntries(
          Object.entries(regexMatchesRaw).map(([field, patterns]) => [
            String(field),
            Array.isArray(patterns) ? patterns.map((p) => String(p)) : [String(patterns)]
          ])
        )
      : {};

  return {
    message_id: String(source.message_id ?? ""),
    raw_text: String(source.raw_text ?? source.clean_text ?? source.cleaned_text ?? ""),
    clean_text: String(source.clean_text ?? source.cleaned_text ?? ""),
    cleaned_text: String(source.cleaned_text ?? source.clean_text ?? ""),
    extracted: {
      pole_id: String(extracted.pole_id ?? ""),
      permit: String(extracted.permit ?? ""),
      permit_number: String(extracted.permit_number ?? extracted.permit ?? ""),
      address: String(extracted.address ?? ""),
      inspection_type: String(extracted.inspection_type ?? ""),
      inspector: String(extracted.inspector ?? ""),
      phone: String(extracted.phone ?? ""),
      email: String(extracted.email ?? ""),
      issue_type: String(extracted.issue_type ?? extracted.inspection_type ?? ""),
      details: String(extracted.details ?? extracted.notes ?? "")
    },
    interpretation: {
      urgency: String(interpretation.urgency ?? "low") as AnalyzeResult["interpretation"]["urgency"],
      action_required: String(interpretation.action_required ?? "Record for standard routing queue"),
      confidence
    },
    routing: {
      team: String(routing.team ?? "Field Services"),
      method: String(routing.method ?? "field_queue"),
      note: String(routing.note ?? "normal")
    },
    explainability: {
      matched_keywords: Array.isArray(explainability.matched_keywords)
        ? explainability.matched_keywords.map((v: unknown) => String(v))
        : [],
      ner_tokens: Array.isArray(explainability.ner_tokens)
        ? explainability.ner_tokens.map((token: any) =>
            typeof token === "string"
              ? token
              : `${String(token?.text ?? "")}${token?.label ? ` (${String(token.label)})` : ""}`
          )
        : [],
      regex_matches: regexMatches
    },
    metadata: {
      model: String(metadata.model ?? "unknown"),
      processing_time_ms: Number(metadata.processing_time_ms ?? 0),
      timestamp: String(metadata.timestamp ?? new Date(0).toISOString()),
      source: String(metadata.source ?? "backend"),
      file:
        metadata.file && typeof metadata.file === "object"
          ? {
              filename: String((metadata.file as Record<string, any>).filename ?? ""),
              size_bytes: Number((metadata.file as Record<string, any>).size_bytes ?? 0)
            }
          : undefined
    }
  };
}
