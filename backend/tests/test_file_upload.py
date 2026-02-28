from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app import pipeline


DATA_DIR = Path(__file__).resolve().parents[1] / "app" / "data" / "mock_emails"


def test_analyze_file_txt_upload():
  client = TestClient(app)
  txt_path = DATA_DIR / "email01.txt"
  response = client.post(
      "/analyze-file",
      files={"file": ("email01.txt", txt_path.read_bytes(), "text/plain")},
  )
  assert response.status_code == 200
  payload = response.json()
  assert payload["metadata"]["file"]["filename"] == "email01.txt"
  assert payload["metadata"]["file"]["size_bytes"] > 0


def test_analyze_file_pdf_upload_if_pdfminer_available():
  if not pipeline.PDFMINER_AVAILABLE:
      return
  client = TestClient(app)
  pdf_path = DATA_DIR / "sample_pdf_text.pdf"
  response = client.post(
      "/analyze-file",
      files={"file": ("sample_pdf_text.pdf", pdf_path.read_bytes(), "application/pdf")},
  )
  assert response.status_code == 200
  payload = response.json()
  assert payload["metadata"]["file"]["filename"] == "sample_pdf_text.pdf"


def test_analyze_file_pdf_upload_without_pdfminer(monkeypatch):
  client = TestClient(app)
  monkeypatch.setattr(pipeline, "PDFMINER_AVAILABLE", False)
  pdf_path = DATA_DIR / "sample_pdf_text.pdf"
  response = client.post(
      "/analyze-file",
      files={"file": ("sample_pdf_text.pdf", pdf_path.read_bytes(), "application/pdf")},
  )
  assert response.status_code == 422
  assert response.json()["detail"] == "pdfminer not installed. Run pip install pdfminer.six"
