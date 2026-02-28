import logging
import os
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("smartroute.main")


class AnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw inspector email text")


class AnalyzeResponse(BaseModel):
    message_id: str
    raw_text: str
    clean_text: str
    extracted: Dict[str, Any]
    interpretation: Dict[str, Any]
    routing: Dict[str, Any]
    explainability: Dict[str, Any]
    metadata: Dict[str, Any]


class SimulateResponse(BaseModel):
    summary: Dict[str, Any]
    results: List[Dict[str, Any]]


app = FastAPI(title="SmartRoute NLP Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _fallback_analyze(text: str) -> Dict[str, Any]:
    digits = "".join(ch for ch in text if ch.isdigit())
    pole_id = f"P-{digits[:5]}" if len(digits) >= 5 else "P-44219"
    return {
        "message_id": f"mock-{abs(hash(text)) % 1000000}",
        "raw_text": text,
        "clean_text": pipeline.clean_text(text),
        "extracted": {
            "pole_id": pole_id,
            "permit": f"PMT-{digits[-4:]}" if len(digits) >= 4 else "PMT-1001",
            "address": "1458 Riverbend Ave",
            "inspection_type": "Electrical Safety Inspection",
            "result": "Failed",
            "inspection_date": "2026-02-28",
            "inspector": "Demo Inspector",
            "contact_name": "Demo Contact",
            "phone": "(555) 310-7788",
            "email": "inspector@example.com",
            "issue_type": "Transformer leak",
            "details": "Deterministic fallback response generated in mock mode.",
            "subject": "Mock Analysis",
            "notes": "Set FALLBACK_MOCK=0 to use live backend extraction.",
        },
        "interpretation": {
            "action_required": "Dispatch field team",
            "urgency": "high",
            "confidence": 0.88,
            "reasons": ["mock_mode", "deterministic_response"],
        },
        "routing": {
            "team": "Field Services",
            "method": "field_queue",
            "note": "urgent",
            "matched_rule": "default",
        },
        "explainability": {
            "matched_keywords": ["urgent", "field"],
            "ner_tokens": [],
            "regex_matches": {"pole_id": [r"\d+"]},
        },
        "metadata": {
            "processing_time_ms": 2.0,
            "model": "fallback-mock-v1",
            "spacy_enabled": False,
            "timestamp": "2026-01-01T00:00:00Z",
        },
    }


def _fallback_simulate() -> Dict[str, Any]:
    return {
        "summary": {
            "processed": 3,
            "processed_count": 3,
            "avg_time_ms": 12.5,
            "avg_processing_time_ms": 12.5,
            "routing_accuracy": 100.0,
            "extraction_accuracy": 92.0,
            "field_accuracy": {"pole_id": 100.0, "permit": 100.0, "address": 75.0, "inspection_type": 92.0},
        },
        "results": [
            {
                "file": "email01.txt",
                "pole_id": "625296",
                "issue_type": "electrical",
                "predicted_team": "Electrical Operations",
                "ground_truth_team": "Electrical Operations",
                "correct": True,
                "urgency": "high",
                "time_ms": 10.0,
            },
            {
                "file": "email02.txt",
                "pole_id": "483220",
                "issue_type": "vegetation",
                "predicted_team": "Vegetation Management",
                "ground_truth_team": "Vegetation Management",
                "correct": True,
                "urgency": "medium",
                "time_ms": 14.0,
            },
            {
                "file": "email03.txt",
                "pole_id": "778120",
                "issue_type": "permit",
                "predicted_team": "Records",
                "ground_truth_team": "Records",
                "correct": True,
                "urgency": "low",
                "time_ms": 13.5,
            },
        ],
    }


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> Dict[str, Any]:
    if os.getenv("FALLBACK_MOCK") == "1":
        return _fallback_analyze(payload.text)
    try:
        return pipeline.analyze_text(payload.text)
    except Exception as exc:
        logger.exception("Unexpected failure while analyzing text")
        raise HTTPException(status_code=500, detail=f"Failed to analyze text: {exc}") from exc


@app.get("/simulate", response_model=SimulateResponse)
def simulate() -> Dict[str, Any]:
    if os.getenv("FALLBACK_MOCK") == "1":
        return _fallback_simulate()
    try:
        return pipeline.run_simulation()
    except Exception as exc:
        logger.exception("Unexpected failure while running simulation")
        raise HTTPException(status_code=500, detail=f"Failed to run simulation: {exc}") from exc
