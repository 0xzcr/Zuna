# Zuna backend

This is the Phase 0 API skeleton. It is intentionally dependency-free and in-memory so the
resource contracts can be tested before choosing production persistence or an auth provider.

## Optional legacy Kokoro server

The website now runs Kokoro directly in a browser worker and does not require this service. This
int8 ONNX server remains available for local API and desktop integration work.

```bash
bash backend/setup-kokoro.sh
backend/.venv/bin/python backend/kokoro_server.py
```

The optional same-origin routes under `/api/kokoro` stream requests to
`http://127.0.0.1:8766`. The current browser reader does not call these routes.

Run both Next.js and Kokoro from the repository root with `npm run dev:full`, or start them
separately with `npm run kokoro` and `npm run dev`.

Run it from the repository root:

```bash
npm run backend
```

Endpoints currently available:

- `GET /health`
- `POST /api/v1/users` — creates a user and a zero-second wallet
- `GET /api/v1/users/:id/wallet`
- `POST /api/v1/books` — accepts guest-safe `userId: null`
- `GET /api/v1/books?page=1&pageSize=20&userId=...`

All errors use `{ error: { code, message, details? } }`. This skeleton does not perform auth,
payments, cloud TTS, or persistence yet.
