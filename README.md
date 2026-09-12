# Zuna

Zuna is a local-first reading companion that turns books a user already owns into private listening sessions. The web app extracts PDF, EPUB, and plain-text books in the browser, separates them into chapters and narration-sized passages, and runs Kokoro text-to-speech locally in a browser worker. Book text, generated audio, playback progress, and the Kokoro model remain on the user’s device.

Live deployment: [zuna.live](https://zuna.live/)

## Product behavior

- **Private by default:** the primary reader never uploads a book or its extracted text. There is no account requirement, database, cloud book library, or hosted TTS dependency for the browser reader.
- **Local narration:** Kokoro runs through Kokoro.js and ONNX Runtime in a dedicated worker. WebGPU is preferred when the device is likely to benefit from it; multithreaded WASM is the reliable fallback.
- **Supported inputs:** PDFs with a text layer, EPUB archives, and UTF-8, UTF-16, or Windows-1252 text files.
- **Incremental reading:** PDFs are extracted in bounded four-page batches. Zuna can publish the first readable content and start preparing narration before the entire document finishes parsing.
- **Chapter-aware playback:** chapter headings are detected from common forms such as `Chapter 1`, Roman numerals, `Part Two`, prologues, appendices, and epilogues. The selected chapter receives priority; only the selected chapter and the next immediate chapter enter the background generation window.
- **Audio continuity:** the active passage and the next passage are prefetched, while an LRU cache limits in-memory audio. IndexedDB stores durable audio for later sessions.
- **Mobile behavior:** phone browsers receive a lightweight “Zuna mobile is coming soon” screen. The reader UI and Kokoro worker are not initialized on phones, preventing a large model download and avoiding an unsupported mobile experience while native mobile work continues.
- **Desktop UI:** the experience is a two-panel scroll-led interface with a library, narrator picker, chapter card rail, progress meters, passage player, theme switch, settings dialog, and first-run model loading progress.

## Technology stack

### Web application

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js 16 App Router | Production routing, static shell, server-rendered entry point, and deployment integration. |
| UI | React 19 | Component composition for the hero, library, voice panel, reader, player, settings, and mobile gate. |
| Language | JavaScript ES modules | Shared browser modules and React components without a separate client API layer. |
| Styling | CSS custom properties and responsive CSS | Theme tokens, dark/light palettes, motion, scroll snapping, responsive breakpoints, and low-dependency rendering. |
| Fonts | `next/font/google` with DM Sans, DM Mono, and Playfair Display | Display, metadata, and passage-reading typography. |
| Hosting | Vercel | Next.js build and static/server deployment. |

The root layout supplies the font variables and document metadata. `app/page.js` dynamically loads `components/zuna-reader.js`, keeping the page entry point small. The reader component renders the product shell, then imports the browser pipeline only after the device gate identifies a non-phone device.

### On-device AI and audio

- **Kokoro.js `^1.2.1`:** browser-facing Kokoro model interface.
- **Kokoro 82M ONNX:** the model is downloaded by the browser runtime and reused from browser cache after the first successful load.
- **ONNX Runtime Web:** provides the inference execution path underneath Kokoro.js.
- **WebGPU:** used when the browser exposes `navigator.gpu` and the device heuristic considers it safe and useful.
- **WASM:** the fallback path for devices without WebGPU, devices with low memory/compute signals, and WebGPU initialization failures.
- **Dedicated module worker:** `frontend/kokoro-worker.mjs` owns model loading and synthesis so inference does not block React rendering or the main thread.
- **Priority queue:** current narration requests have higher priority than the immediate next-chapter work. A generation token cancels superseded work when the user changes passage, chapter, voice, or playback context.
- **Watchdogs:** WebGPU initialization and synthesis have timeouts. A stalled WebGPU load restarts the worker on WASM; a stalled synthesis request terminates and recreates the worker.
- **WAV output:** generated audio is converted to WAV blobs and played through the browser audio element. Playback speed is applied by the player without regenerating audio.

### Document ingestion

#### PDF pipeline

The PDF path uses `pdfjs-dist` and a static worker at `public/pdf.worker.min.mjs`.

1. The file is read locally with `File.arrayBuffer()`.
2. PDF.js opens the document with `isEvalSupported: false`.
3. Pages are processed in four-page batches by `frontend/progressive-pages.mjs`.
4. Each page’s text items are reconstructed using PDF coordinates, `hasEOL`, glyph width, line gaps, and indentation changes.
5. `frontend/reader-core.mjs` normalizes page boundaries, removes repeated headers/footers and standalone Arabic/Roman page numbers, repairs line-wrap hyphenation, detects headings, and creates bounded narration chunks.
6. The first readable batch is published immediately; later batches append to the current document until extraction completes.

`public/pdf.worker.compat.mjs` is the compatibility entrypoint used on older WebKit versions. It supplies guarded fallbacks for APIs used by newer PDF.js builds, including `Promise.withResolvers`, `URL.parse`, `Uint8Array.fromBase64`, `Response.bytes`, and Map/Array/String helpers.

Image-only PDFs are intentionally reported as unreadable text rather than silently sending pages to a server or pretending that narration was generated. OCR is not currently included.

#### EPUB pipeline

`frontend/epub.mjs` uses `fflate` to unzip the EPUB in memory, reads `META-INF/container.xml`, resolves the package document, follows manifest and spine order, decodes XHTML, strips scripts/styles/markup, decodes entities, and returns readable chapter text. Extraction has per-file and aggregate expansion limits to reduce decompression-bomb risk.

#### Plain text pipeline

`frontend/reader-core.mjs` detects BOMs and UTF-16 byte patterns, decodes UTF-8/UTF-16, and includes a Windows-1252 fallback for common legacy text files. All input types converge into the same chapter map and passage chunker.

### Storage and memory controls

`frontend/local-cache.mjs` uses IndexedDB database `zuna-local-v1` with separate stores for:

- `books`: extracted text, chapter map, source metadata, and saved playback state.
- `audio`: generated WAV blobs keyed by book, passage, voice, speed, and text hash.
- `bookIndex` and `audioIndex`: small metadata stores used to list books and evict old audio without loading every blob into memory.

The browser audio cache has a 128 MiB durable-audio budget and an in-memory LRU. Active and queued audio is pinned; unpinned entries are evicted by least-recent access when the limit is reached. Generation is bounded to the current and next immediate chapter instead of generating an entire book in the background. These constraints are designed to reduce browser-tab memory pressure on low-end devices.

### Server routes and legacy backend

The browser reader does not require the server routes for local narration, but the Next.js app retains an optional compatibility API:

- `GET /api/kokoro/voices` proxies the optional local Kokoro service.
- `GET /api/kokoro/voice/:voice` serves a validated Kokoro voice asset with immutable caching.
- `POST /api/kokoro/synthesize` validates and bounds a synthesis request before proxying it to a local Kokoro origin.

The route validation layer caps request bodies at 64 KiB, caps synthesis text at 12,000 characters, validates Kokoro voice identifiers, and bounds speed, pause, and expressiveness values. The standalone `backend/server.mjs` is a dependency-light Phase 0 API skeleton for future account/library work; it is not required by the current local-first reader.

### Security and browser hardening

`next.config.mjs` disables the powered-by header and applies:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Permissions-Policy` disabling camera, microphone, and geolocation

The app uses local file selection instead of server uploads, validates archive expansion sizes, validates voice path parameters, bounds request payloads, and keeps book data in browser storage. These controls do not replace a full production security review, especially if accounts, payments, cloud storage, or server-side narration are added later.

## Repository layout

```text
app/
  layout.js                 Root metadata, fonts, and global CSS entry
  page.js                   App Router page entry
  api/kokoro/               Optional local-runtime proxy routes and validation

components/
  zuna-reader.js            React shell, desktop reader UI, and phone gate
  aceternity.js             UI effects used by the redesign

frontend/
  app.js                    Browser orchestration, import flow, player, and state
  browser-kokoro.mjs        Main-thread API for the speech worker
  kokoro-worker.mjs         Kokoro loading, priority queue, and synthesis
  kokoro-runtime.mjs        Model/backend selection, payloads, and cache helpers
  reader-core.mjs           Text cleanup, chapter detection, and narration chunks
  progressive-pages.mjs     Bounded incremental PDF page processing
  epub.mjs                  Local EPUB extraction
  local-cache.mjs           IndexedDB book/audio storage and eviction
  device.mjs                Phone-device detection used before reader boot
  test/                     Unit and compatibility tests

public/
  assets/                   Locally bundled abstract artwork and attribution
  pdf.worker.min.mjs        PDF.js worker bundle
  pdf.worker.compat.mjs     Older-WebKit compatibility wrapper for PDF.js

backend/
  server.mjs                Dependency-light Phase 0 API skeleton
  kokoro_server.py          Optional local int8 ONNX Kokoro service

mobile/
  App.tsx                   React Native / Expo shell
  src/                      Native navigation, state, and narration seam
  test/                     Mobile state tests

PERF.md                     Reproducible performance measurements
SECURITY.md                 Security guardrails and threat notes
TRUTH_BOARD.md              Product constraints and decisions
```

## Run locally

Install the web dependencies from the repository root:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/). On a supported desktop browser, the first Kokoro load downloads model assets once and later sessions reuse browser cache. Phones intentionally show the mobile-app-coming-soon screen instead of loading the desktop reader runtime.

To run the optional local Python Kokoro service alongside Next.js:

```bash
bash backend/setup-kokoro.sh
npm run dev:full
```

The browser reader still uses its local browser worker; the Python service is for legacy API and desktop integration work.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server on port 4173. |
| `npm run dev:full` | Start the optional Python Kokoro service and Next.js together. |
| `npm test` | Run frontend, backend, and mobile Node test suites. |
| `npm run check` | Syntax-check project modules and run a production Next.js build. |
| `npm run build` | Create the optimized Next.js production build. |
| `npm run start` | Serve the production build on port 4173. |
| `npm run preview` | Alias for the production server on port 4173. |
| `npm run backend` | Start the dependency-light Phase 0 API skeleton. |
| `npm run setup:kokoro` | Create the optional Python Kokoro environment. |
| `npm run kokoro` | Start the optional Python Kokoro server. |
| `git diff --check` | Check patches for whitespace errors. |

## Deployment

The production site is [zuna.live](https://zuna.live/). Vercel detects the Next.js App Router and runs the project build from the repository root:

```bash
npx vercel
npx vercel --prod
```

The deployed site does not need a GPU server for the browser reader. Each visitor downloads the browser model assets and performs narration on their own device. The optional `/api/kokoro/*` routes only reach a local runtime when `KOKORO_ORIGIN` is configured to a reachable service; they are not the primary production narration path.

## Testing and performance checks

The test suite covers PDF text reconstruction, page furniture removal, Roman/Arabic page-number filtering, hyphenation repair, chapter mapping, bounded narration windows, queue priority, cache-key separation, IndexedDB eviction decisions, EPUB extraction, Kokoro payload validation, mobile compatibility, and mobile reader state.

For performance work, use `PERF.md` as the baseline. When profiling a new device, record model-load backend, model-load duration, first-audio latency, generated-audio duration, peak tab memory if available, and whether the page remains responsive during extraction and synthesis. Do not use a whole-book background generation benchmark as a success metric: Zuna intentionally limits work to the current and next chapter to protect browser memory.

## Current limitations

- Scanned-PDF OCR is not implemented; PDFs need a usable text layer.
- The desktop web reader is intentionally gated on phone-sized devices while the native mobile experience is developed.
- The React Native / Expo shell has navigation and state seams but does not yet parse PDFs or run native Kokoro inference.
- Accounts, cloud sync, wallet billing, hosted Sarvam narration, and server-side book processing are not part of the current product.
- Browser support depends on Web Worker, IndexedDB, Web Audio, WebAssembly, and (when selected) WebGPU availability. The PDF compatibility wrapper covers older runtime APIs, but it cannot make a browser support JavaScript syntax that it cannot parse.

## License and artwork

Source code is licensed under the repository license. Abstract artwork is bundled locally; asset credits and license details are in `public/assets/ATTRIBUTIONS.md`.
