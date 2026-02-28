FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# OCR fallback for scanned PDFs is optional and requires system binaries:
# - Tesseract OCR
# - Poppler (for pdf2image)
# Install those manually in custom images/environments if OCR is needed.

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
