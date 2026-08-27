# Zuna backend

This is the Phase 0 API skeleton. It is intentionally dependency-free and in-memory so the
resource contracts can be tested before choosing production persistence or an auth provider.

## Local Kokoro website runtime

The website uses the same local pattern as the Kokoro Voice Lab reference: one int8 ONNX model
and one bundled voice pack, with every discovered voice available at no cost.

```bash
bash backend/setup-kokoro.sh
backend/.venv/bin/python backend/kokoro_server.py
```

Keep the Next.js website running at `http://127.0.0.1:4173/`. The browser uses same-origin routes
under `/api/kokoro`; Next.js streams those requests to `http://127.0.0.1:8766`. No Sarvam, Dodo,
or browser speech fallback is used in this path.

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
