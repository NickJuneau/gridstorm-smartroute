# SmartRoute Backend (FastAPI)

FastAPI NLP service for SmartRoute with regex-first extraction and optional spaCy NER enrichment.

## Endpoints

- `POST /analyze` with body: `{"text":"<raw email>"}`  
  Returns structured output: `message_id`, `raw_text`, `clean_text`, `extracted`, `interpretation`, `routing`, `explainability`, `metadata`.
- `GET /simulate`  
  Processes `app/data/mock_emails/*.txt` and optional `app/data/*.xlsx`, computes summary metrics and per-field accuracy when `app/data/labels.csv` exists.
- `GET /health`  
  Returns `{"status":"ok"}`.

## Local Run

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. (Optional) install spaCy English model:

```bash
python -m spacy download en_core_web_sm
```

4. Start backend:

```bash
bash run_local.sh
```

Frontend expects backend at `http://localhost:8000`.

## Environment Variables

- `BACKEND_HOST` (default: `0.0.0.0`)
- `BACKEND_PORT` (default: `8000`)
- `FALLBACK_MOCK` (`1` enables deterministic mock responses for `/analyze` and `/simulate`)

## Tests

```bash
pytest -q
```

## Docker

```bash
docker compose up --build
```

## Next Manual Steps Checklist

- [ ] Install requirements in a clean venv.
- [ ] (Optional) download `en_core_web_sm` for richer NER explainability.
- [ ] Run `pytest` and verify all tests pass.
- [ ] Start backend and verify `/analyze` from frontend.
