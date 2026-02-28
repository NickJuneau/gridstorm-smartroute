import logging
import csv
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app import pipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("smartroute.main")
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".xlsx"}
ALLOWED_CONTENT_TYPES = {
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
    "",
}


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


class CorrectionRequest(BaseModel):
    raw_text: str = Field(..., min_length=1)
    corrected: Dict[str, Any]
    source: str | None = "ui"


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
            "file": None,
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


async def _read_upload_with_limit(file: UploadFile) -> bytes:
    chunks: List[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
        chunks.append(chunk)
    await file.seek(0)
    return b"".join(chunks)


def _extension(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix


def _corrections_csv_path() -> Path:
    custom = os.getenv("CORRECTIONS_CSV_PATH")
    if custom:
        return Path(custom)
    return Path(__file__).resolve().parent / "data" / "human_corrections.csv"


@app.post("/analyze-file", response_model=AnalyzeResponse)
async def analyze_file(file: UploadFile = File(...)) -> Dict[str, Any]:
    file_name = file.filename or "upload"
    ext = _extension(file_name)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Unsupported file type. Allowed: .txt, .pdf, .xlsx.")
    if (file.content_type or "") not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported content type: {file.content_type}")

    try:
        raw = await _read_upload_with_limit(file)
        size_bytes = len(raw)
        logger.info("analyze-file request: filename=%s size_bytes=%s content_type=%s", file_name, size_bytes, file.content_type)

        if os.getenv("FALLBACK_MOCK") == "1":
            mocked = _fallback_analyze(f"[mock upload] {file_name}")
            mocked.setdefault("metadata", {})
            mocked["metadata"]["file"] = {"filename": file_name, "size_bytes": size_bytes}
            return mocked

        extracted_text = ""
        if ext == ".txt":
            try:
                extracted_text = raw.decode("utf-8")
            except UnicodeDecodeError:
                extracted_text = raw.decode("cp1252", errors="ignore")
            logger.info("File extractor used: txt")
        elif ext == ".xlsx":
            try:
                extracted_text = pipeline.text_from_excel_bytes(raw)
            except Exception as exc:
                raise HTTPException(status_code=422, detail=f"Failed to parse Excel file: {exc}") from exc
        elif ext == ".pdf":
            if not pipeline.PDFMINER_AVAILABLE:
                raise HTTPException(status_code=422, detail="pdfminer not installed. Run pip install pdfminer.six")
            temp_dir = tempfile.mkdtemp(prefix="smartroute_pdf_")
            temp_path = Path(temp_dir) / "upload.pdf"
            try:
                temp_path.write_bytes(raw)
                extracted_text = pipeline.text_from_pdf_path(temp_path)
            finally:
                try:
                    temp_path.unlink(missing_ok=True)
                except Exception:
                    pass
                try:
                    Path(temp_dir).rmdir()
                except Exception:
                    pass

        if not extracted_text.strip():
            raise HTTPException(status_code=422, detail="Uploaded file did not contain extractable text.")

        result = pipeline.analyze_text(extracted_text)
        result.setdefault("metadata", {})
        result["metadata"]["file"] = {"filename": file_name, "size_bytes": size_bytes}
        return result
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected failure while analyzing file upload")
        raise HTTPException(status_code=500, detail=f"Failed to analyze uploaded file: {exc}") from exc


@app.get("/simulate", response_model=SimulateResponse)
def simulate() -> Dict[str, Any]:
    if os.getenv("FALLBACK_MOCK") == "1":
        return _fallback_simulate()
    try:
        return pipeline.run_simulation()
    except Exception as exc:
        logger.exception("Unexpected failure while running simulation")
        raise HTTPException(status_code=500, detail=f"Failed to run simulation: {exc}") from exc


@app.post("/corrections")
def corrections(payload: CorrectionRequest) -> Dict[str, bool]:
    csv_path = _corrections_csv_path()
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    file_exists = csv_path.exists()

    try:
        with open(csv_path, "a", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            if not file_exists:
                writer.writerow(["timestamp", "filename_or_source", "raw_text", "corrected_json"])
            writer.writerow(
                [
                    f"{time.time():.3f}",
                    payload.source or "ui",
                    payload.raw_text,
                    json.dumps(payload.corrected, ensure_ascii=False),
                ]
            )
        logger.info(
            "Saved correction entry source=%s fields=%s",
            payload.source or "ui",
            ",".join(payload.corrected.keys()),
        )
        return {"ok": True}
    except Exception as exc:
        logger.exception("Failed to append correction")
        raise HTTPException(status_code=500, detail=f"Failed to save correction: {exc}") from exc
