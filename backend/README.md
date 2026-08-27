# Zuna backend

This is the Phase 0 API skeleton. It is intentionally dependency-free and in-memory so the
resource contracts can be tested before choosing production persistence or an auth provider.

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
