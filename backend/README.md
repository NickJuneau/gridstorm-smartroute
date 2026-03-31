# SmartRoute Backend (FastAPI)

FastAPI NLP service for SmartRoute with regex-first extraction and optional spaCy NER enrichment.

## Quick Start (PowerShell)

Backend:

```powershell
cd backend
. .venv\Scripts\Activate.ps1
py -3.13 -m pip install -r requirements.txt
py -3.13 -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Backend tests:

```powershell
cd backend
. .venv\Scripts\Activate.ps1
py -3.13 -m pytest -q
```

## Endpoints

- `POST /analyze` with body: `{"text":"<raw email>"}`  
  Returns structured output: `message_id`, `raw_text`, `clean_text`, `extracted`, `interpretation`, `routing`, `explainability`, `metadata`.
- `POST /analyze-file` with multipart field `file` (`.txt`, `.pdf`, `.xlsx`, max 10MB)  
  Extracts text from file and returns the same JSON contract as `/analyze`.
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
  and `/analyze-file`.

## Tests

```bash
pytest -q
```

## Docker

```bash
docker compose up --build
```

## Optional: OCR for scanned PDFs

OCR fallback is used only when PDF text extraction yields fewer than 120 characters.

Windows:
- Install Tesseract OCR and add it to your PATH.
- Install Poppler binaries and add the `bin` folder to PATH (required by `pdf2image`).

Linux:
```bash
sudo apt-get update
sudo apt-get install -y tesseract-ocr poppler-utils
```

macOS:
```bash
brew install tesseract poppler
```

## Next Manual Steps Checklist

- [ ] Install requirements in a clean venv.
- [ ] (Optional) download `en_core_web_sm` for richer NER explainability.
- [ ] Run `pytest` and verify all tests pass.
- [ ] Start backend and verify `/analyze` from frontend.
