from pathlib import Path

import pytest

from app.pipeline import clean_text, determine_urgency_and_action, extract_key_values


DATA_DIR = Path(__file__).resolve().parents[1] / "app" / "data" / "mock_emails"


@pytest.fixture()
def sample_texts():
    files = ["email01.txt", "email02.txt", "email04.txt", "email05.txt", "email12.txt", "email14.txt"]
    return {name: (DATA_DIR / name).read_text(encoding="utf-8") for name in files}


def test_clean_text_removes_security_banners_and_headers(sample_texts):
    raw = sample_texts["email01.txt"]
    cleaned = clean_text(raw)
    assert "CAUTION!" not in cleaned
    assert "PhishAlarm" not in cleaned
    assert "From:" not in cleaned


def test_extract_key_values_finds_permit_and_address(sample_texts):
    extracted = extract_key_values(clean_text(sample_texts["email02.txt"]))
    assert extracted["permit"] == "PMT-88211"
    assert extracted["address"].lower() == "22 oak meadow dr"
    assert extracted["inspection_type"] != ""


def test_extract_key_values_finds_pole_and_email(sample_texts):
    extracted = extract_key_values(clean_text(sample_texts["email04.txt"]))
    assert extracted["pole_id"] == "483220"
    assert extracted["email"] == "lchen@utilitywatch.com"


def test_determine_urgency_emergency(sample_texts):
    cleaned = clean_text(sample_texts["email14.txt"])
    extracted = extract_key_values(cleaned)
    interpretation = determine_urgency_and_action(cleaned, extracted)
    assert interpretation["urgency"] == "emergency"
    assert "Dispatch" in interpretation["action_required"]


def test_determine_urgency_medium_on_failed(sample_texts):
    cleaned = clean_text(sample_texts["email05.txt"])
    extracted = extract_key_values(cleaned)
    interpretation = determine_urgency_and_action(cleaned, extracted)
    assert interpretation["urgency"] in {"medium", "high", "emergency"}


def test_extract_phone_pattern(sample_texts):
    extracted = extract_key_values(clean_text(sample_texts["email12.txt"]))
    assert extracted["phone"] == "555-651-9001"
