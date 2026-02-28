from io import BytesIO

import pandas as pd
from fastapi.testclient import TestClient

from app.main import app


def test_analyze_file_xlsx_returns_per_row_results():
    client = TestClient(app)
    frame = pd.DataFrame(
        [
            {"permit_number": "PMT-1001", "address": "100 Main St", "inspection_type": "Electrical"},
            {"permit_number": "PMT-1002", "address": "200 Main St", "inspection_type": "Vegetation"},
        ]
    )
    buffer = BytesIO()
    frame.to_excel(buffer, index=False)

    response = client.post(
        "/analyze-file",
        files={
            "file": (
                "test.xlsx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload.get("results"), list)
    assert len(payload["results"]) == 2
