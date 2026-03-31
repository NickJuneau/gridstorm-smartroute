# SmartRoute Frontend

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Open http://localhost:3000

## Environment variables

Create `.env.local` using `.env.local.example`.

- `BACKEND_URL` - base URL for analyze proxy (default: `http://localhost:8000`)
- `BACKEND_URL_SIM` - base URL for simulate proxy (default: `BACKEND_URL` or `http://localhost:8000`)
- `FALLBACK_MOCK=1` - enables deterministic mock responses when backend is unavailable
