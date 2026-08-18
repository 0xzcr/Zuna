# Zuna

Zuna is a local-first browser reading companion that turns readable PDF and TXT files into
listening sessions. The browser extracts documents locally and uses the device's native speech
synthesis voices. Vercel serves only the static application.

Live deployment: [zuna-taupe.vercel.app](https://zuna-taupe.vercel.app/)

## Current status

- Supports PDFs with an extractable text layer and plain-text files.
- Extracts PDF text in bounded eight-page batches and can begin playback before the whole file
  is processed.
- Provides narrator choices, playback controls, local resume state, seeking, and playback
  speed controls.
- Keeps document text and playback state on the device. There is no login, database, upload
  API, or server-side book processing.
- Uses browser speech synthesis only. Voice availability and quality depend on the operating
  system and browser.

Scanned-PDF OCR, EPUB support, hosted narration, and whole-book pre-generation are not currently
implemented. The project is a private reading prototype rather than a finished audiobook
renderer.

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

vercel.json               Static deployment rewrites and headers
package.json              Root development and test commands
TRUTH_BOARD.md            Product decisions and guardrails
```
