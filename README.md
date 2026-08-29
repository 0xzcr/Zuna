# Zuna

Zuna is a guest-first, local-first Next.js reading companion that turns the books you already own
into listening sessions. The website extracts documents and runs Kokoro directly in a browser
worker, using WebGPU when available and multithreaded WASM everywhere else.

Live deployment: [zuna-taupe.vercel.app](https://zuna-taupe.vercel.app/)

## Current status

- Rebuilt the responsive website as a navigation-free, scroll-led listening story with oversized
  typography, high-contrast product sections, abstract artwork, and motion inspired by modern
  wallet/product homepages.
- Supports EPUB, PDFs with an extractable text layer, and UTF-8, UTF-16, or Windows-1252 plain-text files.
- Extracts PDF text in bounded four-page batches and can begin playback before the whole file
  is processed.
- Reconstructs fragmented PDF words, removes repeated page headers and footers, repairs wrapped
  hyphenation, and reports image-only PDFs that require OCR.
- Detects common chapter headings, skips front matter on first play, and lets readers jump to
  any chapter from a swipeable card rail while the remaining Kokoro narration generates
  sequentially in the background. Each card shows its own voice-generation progress.
- Provides all 28 voices currently supported by Kokoro.js, playback controls, local resume state, seeking, playback
  speed, settings, and theme controls. A private saved-book shelf reopens locally cached books
  without another import; generated audio and extracted books are cached in IndexedDB.
- Keeps document text and playback state on the device. There is no login, database, upload
  API, or server-side book processing.
- Runs Kokoro on-device; document text is not sent to a hosted narration provider. The model and
  generated audio are cached in the browser after first use.
- Bundles the abstract artwork used by the redesign locally; credits and license details are in
  `public/assets/ATTRIBUTIONS.md`.

Scanned-PDF OCR, EPUB support in the mobile app, Sarvam hosted narration, wallet billing, and
backend auth are not currently implemented. Native mobile Kokoro integration remains a later
Phase 1 task.

## Run locally

Install the web dependencies:

```bash
npm install
```

Start the complete local pipeline with one command:

```bash
npm run dev
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). The first visit downloads the selected
Kokoro model once; later visits reuse the browser cache. Run checks from the repository root:

```bash
npm test
npm run check
git diff --check
```

## Deploy the website

Deploy from the repository root. Vercel detects the Next.js App Router automatically. Narration
still runs on each visitor's device, so the deployment does not require a GPU server or Kokoro API.

```bash
npx vercel
npx vercel --prod
```

## Repository layout

```text
app/                      Next.js layouts, page, and optional legacy Kokoro routes
components/               React-rendered Zuna interface
frontend/                 Local reader pipeline and tests
  app.js                   File intake, caching, buffered playback, and local state
  browser-kokoro.mjs       Main-thread interface to the local speech worker
  kokoro-worker.mjs        WebGPU/WASM Kokoro inference worker
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
