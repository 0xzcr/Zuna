# Zuna

Zuna is a guest-first, local-first reading companion that turns the books you already own into
listening sessions. The website extracts documents locally and uses the device's native speech
synthesis voices while the backend and React Native clients are built in phases.

Live deployment: [zuna-taupe.vercel.app](https://zuna-taupe.vercel.app/)

## Current status

- Rebuilt the responsive website shell with a calm, private listening-room experience.
- Supports PDFs with an extractable text layer and plain-text files.
- Extracts PDF text in bounded eight-page batches and can begin playback before the whole file
  is processed.
- Provides narrator choices, playback controls, local resume state, seeking, playback speed,
  settings, and theme controls.
- Keeps document text and playback state on the device. There is no login, database, upload
  API, or server-side book processing.
- Uses browser speech synthesis only. Voice availability and quality depend on the operating
  system and browser.

Scanned-PDF OCR, EPUB support in the mobile app, Sarvam hosted narration, wallet billing,
backend auth, and whole-book pre-generation are not currently implemented. The website now has
a local Kokoro runtime path; native mobile Kokoro integration remains a later Phase 1 task.

## Run locally

Zuna is a zero-build static app:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173/frontend/](http://127.0.0.1:4173/frontend/). Run checks from the
repository root:

```bash
npm test
npm run check
git diff --check
```

## Deploy to Vercel

Deploy from the repository root. The root `vercel.json` rewrites the public application paths
to `frontend/`, so the existing deployment URL remains unchanged.

```bash
npx vercel
npx vercel --prod
```

## Repository layout

```text
frontend/                 Browser application and tests
  index.html               UI shell
  app.js                   File intake, cleanup, playback, and local state
  progressive-pages.mjs   Bounded PDF extraction
  assets/                 Artwork
  test/                   Application tests

backend/                  Phase 0 API skeleton and tests
mobile/                   React Native / Expo app shell and tests

vercel.json               Static deployment rewrites and headers
package.json              Root development and test commands
TRUTH_BOARD.md            Product decisions and guardrails
```
