# Zuna

Zuna is a private reading companion that turns readable books into listening sessions.

Upload a readable PDF or text file, choose a narrator, and start listening in the browser. The current experience is intentionally simple: no account, no upload pipeline, and no server-side processing of the book itself.

> Your books, given a voice worth listening to.

[Open the live demo](https://zuna-taupe.vercel.app/)

## What is live

The deployed prototype currently supports:

- readable PDF and plain-text file intake;
- local text extraction and cleanup in the browser;
- sentence-based passage playback;
- two prototype narrator choices, Elias and Mira;
- play, pause, previous, next, seek, and playback speed controls;
- local resume position and narrator preferences;
- browser-local Kokoro narration with Web Speech as a fallback;
- responsive desktop and mobile layouts.

The public demo currently labels the intake as PDF and uses the two prototype voices to validate the listening flow. The product direction is broader: books first, with richer formats and chapter-aware reading to follow.

## Privacy model

Zuna is designed to keep the reading experience on the user’s device.

- The selected book is read in the browser.
- Extracted text is prepared locally for narration.
- Book content is not sent to a Zuna backend.
- Playback position and preferences are stored locally in the browser.
- No login, database, file storage, or server-side narration is required by the current prototype.

The browser downloads the narration runtime and model files on first use. That model download is separate from the user’s book content.

## Narration

The current browser prototype runs a quantized Kokoro-82M ONNX model through `kokoro-js` inside a Web Worker. The model is loaded on demand, cached by the browser, and executed locally with WebAssembly. If the local runtime is unavailable, Zuna falls back to the browser’s speech synthesis API.

Elias and Mira are prototype voice personas, not imitations of named actors. The next narrator milestone is one calm, warm female voice with an unhurried, intimate, quietly wise delivery. That custom model is being trained and optimized separately and is not bundled with the current deployment.

## Current limitations

- Scanned or image-only PDFs are not supported because OCR is not included yet.
- EPUB and other book formats are not wired in yet.
- Chapter detection and “start at Chapter 1” behavior are planned parser features, not capabilities of the TTS model.
- Narration quality depends on the browser, device memory, and first model download.
- The current demo is optimized for modern desktop browsers; mobile support is experimental.
- There is no audiobook export, cloud library, sync, account system, or social sharing.

## Run locally

Zuna is a zero-build static app. Serve the repository over HTTP so browser modules and workers load correctly:

```bash
npm run dev
```

Then open [http://127.0.0.1:4173](http://127.0.0.1:4173).

Before committing or deploying, run:

```bash
npm run check
```

## Deploy to Vercel

The repository is prepared for a static Vercel deployment. Import the repository, use the **Other** framework preset, leave the build command empty, and deploy from the repository root. The current app does not require environment variables or server-side services.

```bash
npx vercel
npx vercel --prod
```

Vercel serves the static shell, worker, styles, configuration, and artwork. PDF extraction, narration, playback, and local progress remain client-side.

## Project structure

```text
index.html       Browser shell and product UI
styles.css       Visual system, background treatment, and responsive layout
assets/          Optimized framed artwork background
app.js           File intake, text cleanup, playback, and local state
tts-worker.js    Browser-local Kokoro TTS worker
vercel.json      Static deployment headers and asset caching
.vercelignore    Training/model artifacts excluded from deploys
package.json     Local checks and static preview scripts
TRUTH_BOARD.md   Product decisions, hypotheses, and guardrails
```

## Roadmap

1. Replace the prototype voices with the trained calm female narrator.
2. Add deterministic book cleanup and chapter-start detection.
3. Add EPUB support and stronger long-form chunking.
4. Improve first-audio time, pronunciation, pauses, and resume behavior across devices.

Zuna is successful when someone can bring a book they meant to finish, hear the first passage quickly, and return to it without giving up their private reading data.
