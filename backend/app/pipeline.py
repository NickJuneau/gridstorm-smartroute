from __future__ import annotations

import hashlib
import io
import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text

    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

logger = logging.getLogger("smartroute.pipeline")
logger.setLevel(logging.INFO)

# Explicit result object schema used across the app.
RESULT_SCHEMA: Dict[str, Any] = {
    "message_id": "string",
    "raw_text": "string",
    "clean_text": "string",
    "extracted": {
        "pole_id": "string",
        "permit": "string",
        "address": "string",
        "inspection_type": "string",
        "result": "string",
        "inspection_date": "string",
        "inspector": "string",
        "contact_name": "string",
        "phone": "string",
        "email": "string",
        "issue_type": "string",
        "details": "string",
        "subject": "string",
        "notes": "string",
    },
    "interpretation": {
        "action_required": "string",
        "urgency": "string",
        "confidence": "float",
        "reasons": ["string"],
    },
    "routing": {
        "team": "string",
        "method": "string",
        "note": "string",
        "matched_rule": "string",
    },
    "explainability": {
        "matched_keywords": ["string"],
        "ner_tokens": [{"text": "string", "label": "string"}],
        "regex_matches": {"field": ["pattern"]},
    },
    "metadata": {
        "processing_time_ms": "float",
        "model": "string",
        "spacy_enabled": "bool",
        "timestamp": "string",
    },
}

HEADER_RE = re.compile(r"^\s*(from|sent|to|cc|bcc)\s*:", re.IGNORECASE)
SECURITY_BANNER_RE = re.compile(r"(caution!?|phishalarm|external email)", re.IGNORECASE)
SIGNATURE_START_RE = re.compile(r"^\s*(respectfully|sincerely|best regards|regards|thanks[,!]?)\b", re.IGNORECASE)
KEY_VALUE_RE = re.compile(r"^\s*([A-Za-z][A-Za-z0-9 #/_\-\.\(\)]{1,50})\s*:\s*(.+?)\s*$")
PHONE_RE = re.compile(r"(\+?1?[\s\-.]?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4})")
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PERMIT_RE = re.compile(r"\bpermit(?:\s*(?:number|no\.?|#))?\s*[:#]?\s*([A-Z0-9-]{3,})", re.IGNORECASE)
POLE_RE = re.compile(r"\bpole(?:\s*(?:id|number|#))?\s*[:#]?\s*([A-Z0-9-]{3,12})", re.IGNORECASE)
HASH_ID_RE = re.compile(r"#\s?(\d{4,10})")
ADDRESS_RE = re.compile(
    r"\b\d{1,5}\s+[A-Za-z0-9.\-']+(?:\s+[A-Za-z0-9.\-']+){0,5}\s"
    r"(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court)\b",
    re.IGNORECASE,
)
DATE_RE = re.compile(r"\b(20\d{2}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]20\d{2})\b")

FIELD_ALIASES = {
    "permit": "permit",
    "permit number": "permit",
    "permit #": "permit",
    "permit no": "permit",
    "site address": "address",
    "address": "address",
    "inspection type": "inspection_type",
    "inspection category": "inspection_type",
    "type": "inspection_type",
    "result": "result",
    "inspection date": "inspection_date",
    "date": "inspection_date",
    "inspector": "inspector",
    "contact name": "contact_name",
    "contact": "contact_name",
    "phone": "phone",
    "phone number": "phone",
    "e-mail": "email",
    "email": "email",
    "notes": "notes",
    "description": "details",
    "details": "details",
    "subject": "subject",
    "pole": "pole_id",
    "pole id": "pole_id",
    "pole #": "pole_id",
}

TEAM_MAP_CACHE: Optional[pd.DataFrame] = None
SPACY_MODEL = None


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _normalize_key(key: str) -> str:
    return re.sub(r"\s+", " ", key.strip().lower())


def _normalize_str(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def text_from_excel_bytes(content: bytes) -> str:
    """
    Extract textual content from an .xlsx file represented as bytes.
    """
    frame = pd.read_excel(io.BytesIO(content), sheet_name=None)
    lines: List[str] = []
    for sheet_name, sheet_df in frame.items():
        lines.append(f"[Sheet: {sheet_name}]")
        for _, row in sheet_df.fillna("").iterrows():
            row_values = [str(v).strip() for v in row.tolist() if str(v).strip()]
            if row_values:
                lines.append(" | ".join(row_values))
    text = "\n".join(lines).strip()
    logger.info("Excel extractor used; extracted_chars=%s", len(text))
    return text


def text_from_pdf_path(path: Path) -> str:
    """
    Extract text from PDF using pdfminer.
    """
    if not PDFMINER_AVAILABLE:
        raise RuntimeError("pdfminer not installed")
    text = pdfminer_extract_text(str(path)) or ""
    logger.info("PDF extractor used: pdfminer; extracted_chars=%s", len(text))
    return text.strip()


def ocr_pdf(path: Path) -> str:
    """
    Optional OCR fallback for scanned PDFs using pdf2image + pytesseract.
    Returns empty string when dependencies are unavailable.
    """
    try:
        from pdf2image import convert_from_path  # type: ignore
        import pytesseract  # type: ignore
    except Exception:
        logger.info("OCR extractor unavailable: install pdf2image + pytesseract (+ poppler/tesseract binaries)")
        return ""

    try:
        images = convert_from_path(str(path))
        ocr_parts: List[str] = []
        for image in images:
            txt = pytesseract.image_to_string(image)
            if txt and txt.strip():
                ocr_parts.append(txt.strip())
        text = "\n".join(ocr_parts).strip()
        logger.info("PDF extractor used: OCR fallback; extracted_chars=%s", len(text))
        return text
    except Exception as exc:
        logger.info("OCR extractor failed: %s", exc)
        return ""


def clean_text(raw: str) -> str:
    """
    Normalize raw email text:
    - Remove common email headers.
    - Remove security banners (CAUTION, PhishAlarm, external warning lines).
    - Truncate likely signatures.
    - Collapse repeated whitespace while preserving meaningful lines.
    """
    lines = raw.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cleaned_lines: List[str] = []
    signature_mode = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        if HEADER_RE.match(stripped):
            continue
        if SECURITY_BANNER_RE.search(stripped):
            continue
        if SIGNATURE_START_RE.match(stripped):
            signature_mode = True
        if signature_mode:
            # Skip long signature links and post-signature footer text.
            if "http" in stripped.lower() or len(stripped) > 120:
                continue
            if stripped.lower().startswith(("phone:", "mobile:", "office:", "email:")):
                continue
        if signature_mode:
            continue
        cleaned_lines.append(re.sub(r"\s+", " ", stripped))

    text = "\n".join(cleaned_lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def _record_match(regex_matches: Dict[str, List[str]], field: str, pattern: str) -> None:
    regex_matches.setdefault(field, [])
    if pattern not in regex_matches[field]:
        regex_matches[field].append(pattern)
        logger.debug("Regex matched field=%s pattern=%s", field, pattern)


def _infer_issue_type(extracted: Dict[str, Any], full_text: str) -> str:
    source = " ".join(
        [
            extracted.get("inspection_type", ""),
            extracted.get("result", ""),
            extracted.get("details", ""),
            extracted.get("notes", ""),
            full_text,
        ]
    ).lower()

    if any(k in source for k in ["transformer", "live wire", "sparking", "electrical", "power"]):
        return "electrical"
    if any(k in source for k in ["gas", "leak", "odor"]):
        return "gas"
    if any(k in source for k in ["vegetation", "tree", "branch", "trim"]):
        return "vegetation"
    if any(k in source for k in ["permit", "documentation", "records", "approval"]):
        return "permit"
    if any(k in source for k in ["vehicle", "collision", "truck", "impact"]):
        return "vehicle"
    return "field_services"


def extract_key_values(text: str) -> Dict[str, Any]:
    """
    Regex-first extraction for key inspector fields.
    Uses key/value line parsing first, then robust fallback patterns.
    """
    extracted: Dict[str, Any] = {
        "pole_id": "",
        "permit": "",
        "address": "",
        "inspection_type": "",
        "result": "",
        "inspection_date": "",
        "inspector": "",
        "contact_name": "",
        "phone": "",
        "email": "",
        "issue_type": "",
        "details": "",
        "subject": "",
        "notes": "",
    }
    regex_matches: Dict[str, List[str]] = {}

    lines = text.splitlines()
    for line in lines:
        match = KEY_VALUE_RE.match(line)
        if not match:
            continue
        key_raw, value = match.group(1), match.group(2).strip()
        key = _normalize_key(key_raw)
        canonical = FIELD_ALIASES.get(key)
        if canonical and value and not extracted.get(canonical):
            extracted[canonical] = value
            _record_match(regex_matches, canonical, r"key_value_line")

    permit_match = PERMIT_RE.search(text)
    if permit_match and not extracted["permit"]:
        extracted["permit"] = permit_match.group(1).strip()
        _record_match(regex_matches, "permit", PERMIT_RE.pattern)

    pole_match = POLE_RE.search(text)
    if pole_match and not extracted["pole_id"]:
        extracted["pole_id"] = pole_match.group(1).strip()
        _record_match(regex_matches, "pole_id", POLE_RE.pattern)
    if not extracted["pole_id"]:
        hash_match = HASH_ID_RE.search(text)
        if hash_match:
            extracted["pole_id"] = hash_match.group(1)
            _record_match(regex_matches, "pole_id", HASH_ID_RE.pattern)

    address_match = ADDRESS_RE.search(text)
    if address_match and not extracted["address"]:
        extracted["address"] = address_match.group(0).strip()
        _record_match(regex_matches, "address", ADDRESS_RE.pattern)

    phone_match = PHONE_RE.search(text)
    if phone_match and not extracted["phone"]:
        extracted["phone"] = phone_match.group(1).strip()
        _record_match(regex_matches, "phone", PHONE_RE.pattern)

    email_match = EMAIL_RE.search(text)
    if email_match and not extracted["email"]:
        extracted["email"] = email_match.group(0).strip()
        _record_match(regex_matches, "email", EMAIL_RE.pattern)

    date_match = DATE_RE.search(text)
    if date_match and not extracted["inspection_date"]:
        extracted["inspection_date"] = date_match.group(1).strip()
        _record_match(regex_matches, "inspection_date", DATE_RE.pattern)

    if not extracted["details"]:
        narrative_lines = [ln for ln in lines if ":" not in ln and len(ln.strip()) > 12]
        if narrative_lines:
            extracted["details"] = " ".join(narrative_lines[:2]).strip()
            _record_match(regex_matches, "details", r"narrative_fallback")

    if not extracted["notes"] and extracted["details"]:
        extracted["notes"] = extracted["details"]

    if not extracted["inspection_type"]:
        combined = " ".join(lines).lower()
        candidates = [
            ("electrical", ["electrical", "transformer", "wire"]),
            ("gas", ["gas", "odor"]),
            ("vegetation", ["vegetation", "tree", "branch"]),
            ("permit", ["permit", "approval", "records"]),
            ("field", ["field", "site"]),
        ]
        for label, keywords in candidates:
            if any(k in combined for k in keywords):
                extracted["inspection_type"] = label
                _record_match(regex_matches, "inspection_type", f"keyword:{label}")
                break

    if not extracted["result"]:
        lowered = text.lower()
        if "failed" in lowered or "fail" in lowered:
            extracted["result"] = "Failed"
            _record_match(regex_matches, "result", r"failed")
        elif "approved" in lowered or "pass" in lowered:
            extracted["result"] = "Approved"
            _record_match(regex_matches, "result", r"approved|pass")

    extracted["issue_type"] = _infer_issue_type(extracted, text)
    extracted["regex_matches"] = regex_matches
    return extracted


def determine_urgency_and_action(cleaned_text: str, extracted: Dict[str, Any]) -> Dict[str, Any]:
    lowered = f"{cleaned_text} {extracted.get('details', '')} {extracted.get('result', '')}".lower()

    emergency_terms = ["on fire", "downed", "live wire", "electrocute", "sparking"]
    high_terms = ["urgent", "asap", "immediate", "immediately", "critical"]
    medium_terms = ["soon", "follow-up", "recommended", "monitor", "trim within"]

    reasons: List[str] = []
    urgency = "low"

    for term in emergency_terms:
        if term in lowered:
            reasons.append(term)
    if reasons:
        urgency = "emergency"
    else:
        for term in high_terms:
            if term in lowered:
                reasons.append(term)
        if reasons:
            urgency = "high"
        elif any(term in lowered for term in medium_terms):
            urgency = "medium"
            reasons.append("scheduled_follow_up")

    if extracted.get("result", "").lower() == "failed" and urgency == "low":
        urgency = "medium"
        reasons.append("failed_inspection")

    action_map = {
        "emergency": "Dispatch emergency response immediately",
        "high": "Prioritize work order and dispatch within 24 hours",
        "medium": "Create work order for scheduled follow-up",
        "low": "Record for standard routing queue",
    }
    confidence = 0.55 + min(len(reasons), 4) * 0.1
    return {
        "action_required": action_map[urgency],
        "urgency": urgency,
        "confidence": round(min(confidence, 0.99), 2),
        "reasons": reasons or ["default_low_urgency"],
    }


def _load_team_map() -> pd.DataFrame:
    global TEAM_MAP_CACHE
    if TEAM_MAP_CACHE is not None:
        return TEAM_MAP_CACHE
    path = Path(__file__).resolve().parent / "team_map.csv"
    TEAM_MAP_CACHE = pd.read_csv(path).fillna("")
    return TEAM_MAP_CACHE


def route_issue(extracted: Dict[str, Any], interpretation: Dict[str, Any]) -> Dict[str, Any]:
    team_map = _load_team_map()
    search_text = " ".join(
        [
            str(extracted.get("inspection_type", "")),
            str(extracted.get("issue_type", "")),
            str(extracted.get("details", "")),
            str(extracted.get("notes", "")),
        ]
    ).lower()

    matched_row = None
    for _, row in team_map.iterrows():
        key = str(row.get("issue_type", "")).strip().lower()
        if not key or key == "default":
            continue
        if key in search_text:
            matched_row = row
            break

    if matched_row is None:
        default_rows = team_map[team_map["issue_type"].str.lower() == "default"]
        matched_row = default_rows.iloc[0] if not default_rows.empty else {"team": "Field Services", "method": "field_queue", "issue_type": "default"}

    note = "urgent" if interpretation.get("urgency") in {"high", "emergency"} else "normal"
    return {
        "team": str(matched_row.get("team", "Field Services")),
        "method": str(matched_row.get("method", "field_queue")),
        "note": note,
        "matched_rule": str(matched_row.get("issue_type", "default")),
    }


def _load_spacy_model():
    global SPACY_MODEL
    if SPACY_MODEL is not None:
        return SPACY_MODEL
    try:
        import spacy  # type: ignore

        SPACY_MODEL = spacy.load("en_core_web_sm")
    except Exception as exc:
        logger.info("spaCy model not available, continuing without NER enrichment: %s", exc)
        SPACY_MODEL = False
    return SPACY_MODEL


def _collect_matched_keywords(*texts: str) -> List[str]:
    keywords = ["urgent", "asap", "immediate", "emergency", "leak", "downed", "transformer", "vegetation", "permit", "fire"]
    blob = " ".join(texts).lower()
    return sorted({kw for kw in keywords if kw in blob})


def analyze_text(raw_text: str) -> Dict[str, Any]:
    start = time.perf_counter()
    raw_text = raw_text or ""
    clean = clean_text(raw_text)
    extracted = extract_key_values(clean)
    regex_matches = extracted.pop("regex_matches", {})
    interpretation = determine_urgency_and_action(clean, extracted)
    routing = route_issue(extracted, interpretation)

    ner_tokens: List[Dict[str, str]] = []
    nlp = _load_spacy_model()
    if nlp:
        try:
            doc = nlp(clean[:5000])
            ner_tokens = [{"text": ent.text, "label": ent.label_} for ent in doc.ents[:30]]
        except Exception as exc:
            logger.info("spaCy NER execution failed: %s", exc)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    message_id = hashlib.md5(clean.encode("utf-8")).hexdigest()[:12]

    return {
        "message_id": message_id,
        "raw_text": raw_text,
        "clean_text": clean,
        "extracted": extracted,
        "interpretation": interpretation,
        "routing": routing,
        "explainability": {
            "matched_keywords": _collect_matched_keywords(clean, extracted.get("details", ""), extracted.get("inspection_type", "")),
            "ner_tokens": ner_tokens,
            "regex_matches": regex_matches,
        },
        "metadata": {
            "processing_time_ms": elapsed_ms,
            "model": "regex-first-v1",
            "spacy_enabled": bool(nlp),
            "timestamp": _now_iso(),
        },
    }


def _read_text_files(folder: Path) -> Iterable[Tuple[str, str]]:
    for path in sorted(folder.glob("*.txt")):
        try:
            yield path.name, path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            yield path.name, path.read_text(encoding="latin-1", errors="ignore")


def _read_xlsx_inputs(folder: Path) -> Iterable[Tuple[str, str]]:
    for path in sorted(folder.glob("*.xlsx")):
        frame = pd.read_excel(path)
        for idx, row in frame.fillna("").iterrows():
            text = ""
            for candidate in ["text", "email", "body", "notes", "description"]:
                if candidate in frame.columns and str(row[candidate]).strip():
                    text = str(row[candidate]).strip()
                    break
            if not text:
                text = " | ".join([str(value).strip() for value in row.tolist() if str(value).strip()])
            if text:
                yield f"{path.name}#row{idx + 1}", text


def _load_labels(path: Path) -> Dict[str, Dict[str, Any]]:
    if not path.exists():
        return {}
    labels_df = pd.read_csv(path).fillna("")
    labels: Dict[str, Dict[str, Any]] = {}
    for _, row in labels_df.iterrows():
        file_name = str(row.get("file", "")).strip()
        if file_name:
            labels[file_name] = {k: str(v) for k, v in row.to_dict().items()}
    return labels


def run_simulation() -> Dict[str, Any]:
    base = Path(__file__).resolve().parent
    data_dir = base / "data"
    txt_dir = data_dir / "mock_emails"
    labels = _load_labels(data_dir / "labels.csv")

    results: List[Dict[str, Any]] = []
    timing: List[float] = []
    comparable_count = 0
    routing_correct = 0
    field_totals = {"pole_id": 0, "permit": 0, "address": 0, "inspection_type": 0}
    field_hits = {"pole_id": 0, "permit": 0, "address": 0, "inspection_type": 0}

    for file_name, text in list(_read_text_files(txt_dir)) + list(_read_xlsx_inputs(data_dir)):
        analyzed = analyze_text(text)
        extracted = analyzed["extracted"]
        interpretation = analyzed["interpretation"]
        routing = analyzed["routing"]
        time_ms = float(analyzed["metadata"]["processing_time_ms"])
        timing.append(time_ms)

        label = labels.get(file_name, {})
        gt_team = label.get("ground_truth_team", "") if label else ""
        correct = None
        if gt_team:
            comparable_count += 1
            correct = routing["team"].strip().lower() == gt_team.strip().lower()
            if correct:
                routing_correct += 1

        for field in field_totals:
            gt_value = _normalize_str(label.get(field, "")) if label else ""
            if gt_value:
                field_totals[field] += 1
                if _normalize_str(extracted.get(field, "")) == gt_value:
                    field_hits[field] += 1

        results.append(
            {
                "file": file_name,
                "pole_id": extracted.get("pole_id", ""),
                "issue_type": extracted.get("issue_type", ""),
                "predicted_team": routing.get("team", ""),
                "ground_truth_team": gt_team or None,
                "correct": correct,
                "urgency": interpretation.get("urgency", "low"),
                "time_ms": time_ms,
                "extracted": extracted,
                "interpretation": interpretation,
                "routing": routing,
                "labels_if_any": label or None,
            }
        )

    processed = len(results)
    avg_time = round(sum(timing) / processed, 2) if processed else 0.0
    routing_accuracy = round((routing_correct / comparable_count) * 100, 2) if comparable_count else 0.0

    field_accuracy: Dict[str, float] = {}
    for field, total in field_totals.items():
        field_accuracy[field] = round((field_hits[field] / total) * 100, 2) if total else 0.0

    nonzero_fields = [v for v in field_accuracy.values() if v > 0]
    extraction_accuracy = round(sum(nonzero_fields) / len(nonzero_fields), 2) if nonzero_fields else 0.0

    return {
        "summary": {
            "processed": processed,
            "processed_count": processed,
            "avg_time_ms": avg_time,
            "avg_processing_time_ms": avg_time,
            "routing_accuracy": routing_accuracy,
            "extraction_accuracy": extraction_accuracy,
            "field_accuracy": field_accuracy,
            "schema": RESULT_SCHEMA,
        },
        "results": results,
    }


if __name__ == "__main__":
    sample = "Subject: Urgent issue\nPole: 625296\nAddress: 101 Main St\nInspection Type: electrical\nResult: Failed"
    print(analyze_text(sample))
