# Zuna

Zuna is a guest-first, local-first Next.js reading companion that turns the books you already own
into listening sessions. The website extracts documents locally and sends narration requests only
to the Kokoro runtime on the same computer.

Live deployment: [zuna-taupe.vercel.app](https://zuna-taupe.vercel.app/)

## Current status

- Rebuilt the responsive website shell with a calm, private listening-room experience.
- Supports EPUB, PDFs with an extractable text layer, and plain-text files.
- Extracts PDF text in bounded four-page batches and can begin playback before the whole file
  is processed.
- Detects common chapter headings, skips front matter on first play, and lets readers jump to
  any chapter while the remaining Kokoro narration generates sequentially in the background.
- Provides all 54 local Kokoro voices, playback controls, local resume state, seeking, playback
  speed, settings, and theme controls. Generated audio and extracted books are cached in IndexedDB.
- Keeps document text and playback state on the device. There is no login, database, upload
  API, or server-side book processing.
- Uses the local Kokoro runtime; document text is not sent to a hosted narration provider.

Scanned-PDF OCR, EPUB support in the mobile app, Sarvam hosted narration, wallet billing, and
backend auth are not currently implemented. Native mobile Kokoro integration remains a later
Phase 1 task.

## Run locally

Install the web dependencies and the local Kokoro model once:

```bash
npm install
npm run setup:kokoro
```

Then start the complete local pipeline with one command:

```bash
npm run dev:full
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). For separate terminals, use `npm run
kokoro` and `npm run dev`. Run checks from the repository root:

```bash
npm test
npm run check
git diff --check
```

## Deploy the web shell

Deploy from the repository root. Vercel detects the Next.js App Router automatically. The hosted
web shell cannot reach a Kokoro process running on a visitor's computer; packaged desktop/mobile
runtimes remain the production path for fully local narration.

```bash
npx vercel
npx vercel --prod
```

## Repository layout

```text
app/                      Next.js layouts, page, and same-origin Kokoro routes
components/               React-rendered Zuna interface
frontend/                 Local reader pipeline and tests
  app.js                   File intake, caching, playback, and local state
  epub.mjs                 Local EPUB extraction
  local-cache.mjs          IndexedDB text and WAV cache
  progressive-pages.mjs    Bounded PDF extraction
  test/                    Application tests
public/                    Static artwork and the PDF.js worker

backend/                  Phase 0 API skeleton and tests
mobile/                   React Native / Expo app shell and tests

package.json              Root development and test commands
PERF.md                   Reproducible performance measurements
TRUTH_BOARD.md            Product decisions and guardrails
```
