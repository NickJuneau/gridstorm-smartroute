from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_corrections_endpoint_appends_csv(monkeypatch, tmp_path):
    csv_path = tmp_path / "human_corrections.csv"
    monkeypatch.setenv("CORRECTIONS_CSV_PATH", str(csv_path))

    client = TestClient(app)
    payload = {
        "raw_text": "Permit Number: PMT-1001",
        "corrected": {
            "permit_number": "PMT-1001",
            "address": "1458 Riverbend Ave",
            "inspection_type": "Electrical",
            "inspector": "Alex Rivera",
        },
        "source": "ui",
    }

    response = client.post("/corrections", json=payload)
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    assert csv_path.exists()
    content = csv_path.read_text(encoding="utf-8")
    assert "timestamp,filename_or_source,raw_text,corrected_json" in content
    assert "Permit Number: PMT-1001" in content

    csv_path.unlink(missing_ok=True)
