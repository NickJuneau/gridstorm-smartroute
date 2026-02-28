export type UrgencyLevel = "low" | "medium" | "high";

export type AnalyzeResult = {
  cleaned_text: string;
  extracted: {
    pole_id: string;
    address: string;
    inspector: string;
    phone: string;
    email: string;
    issue_type: string;
    details: string;
  };
  interpretation: {
    urgency: UrgencyLevel;
    action_required: string;
    confidence: number;
  };
  routing: {
    team: string;
    method: string;
    note: string;
  };
  explainability: {
    matched_keywords: string[];
    ner_tokens: string[];
  };
  metadata: {
    model: string;
    processing_time_ms: number;
    timestamp: string;
    source: string;
  };
};

export type AnalyzeApiError = {
  error: string;
  details?: string;
};

export type SimulationResult = {
  file: string;
  pole_id: string;
  issue_type: string;
  predicted_team: string;
  ground_truth_team?: string;
  correct?: boolean;
  urgency: string;
  time_ms: number;
};

export type SimulationResponse = {
  summary: {
    processed_count: number;
    extraction_accuracy: number;
    routing_accuracy: number;
    avg_processing_time_ms: number;
  };
  results: SimulationResult[];
};
