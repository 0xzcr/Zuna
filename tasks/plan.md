# Implementation Plan: Zuna rebuild

## Overview

Rebuild Zuna as a guest-first, local-first audiobook reader with a polished web surface, a shared backend for paid narration and billing, and a React Native mobile client. The implementation follows the specification's phase order: web foundation first, then backend contracts, then the mobile client and shared pipeline.

## Architecture decisions

- Keep the website dependency-light while the product surface is being validated; local PDF/TXT extraction and browser speech remain usable without an account.
- Treat the passage/chunk as the shared unit of playback so the free local path and future paid cloud path can use the same state model.
- Keep document text and free-tier progress local. Backend records are introduced only for authenticated wallet/generation flows.
- Keep payment and narration credentials server-side and represent pricing as configuration, not literals in UI or business logic.
- Add the backend and mobile app as separate workspaces so each surface can be tested and deployed independently.

## Task list

### Website foundation

- [x] Rebuild the responsive Zuna website shell and visual system.
- [x] Preserve local PDF/TXT import, incremental PDF extraction, narrator choice, resume state, and browser playback.
- [x] Replace browser speech with the local Kokoro runtime, dynamic 54-voice discovery, and free WAV generation.
- [x] Add mobile navigation, settings dialog, product promise strip, and Zuna+ teaser.
- [x] Extract reader text cleanup/chunking into a tested pure module.

### Checkpoint: Website

- [x] `npm test`, `npm run check`, and `git diff --check` pass.
- [x] Desktop and mobile browser screenshots verified.
- [x] Import, narrator selection, settings, and playback interactions verified.

### Phase 0: Backend skeleton

- [x] Define user, wallet, book, and chunk state contracts.
- [x] Implement guest-safe user creation, `$0` wallet state, and book creation endpoints.
- [x] Add request validation, error states, security headers, rate limiting, health check, and focused API tests.
- [x] Add environment-driven origin/port configuration with no provider secrets in client code.

### Phase 1: Mobile core loop

- [x] Scaffold the React Native iOS/Android app.
- [x] Add guest import/library/player flows around the shared chunk state model.
- [x] Add the Kokoro ONNX integration seam; native extraction and ONNX generation remain next.

### Phase 2+: Paid narration and polish

- [ ] Add server-side Sarvam WebSocket generation and wallet metering.
- [ ] Add Dodo hosted checkout and webhook handling.
- [ ] Add Zuna+, Tier 2 chapter detection, voice preview, sleep timer, and cache policy.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Kokoro performance varies by device | High | Keep the first chunk small, warm the model once, and benchmark target devices before promising timing. |
| Sarvam/Dodo contracts can change | High | Use provider adapters and environment config; verify current docs before integration. |
| Guest and paid data boundaries drift | High | Keep local book/chunk storage separate from backend billing records. |
| Browser and native UI diverge | Medium | Share domain contracts and state names, not platform-specific UI code. |

## Open decisions

- Final auth method: email/OTP, Apple/Google OAuth, or a mix.
- Backend persistence choice for production deployment.
- Current Sarvam pricing/rate limits and Dodo credit primitives.
- Region-specific external checkout vs. IAP routing.
