# Zuna

Zuna is a **local-first browser prototype** that turns readable PDF and TXT files into
audio. It is not a hosted audiobook-generation service: the static site, browser worker,
and model files are delivered by Vercel, while book extraction and narration run on the
user's device.

Live deployment: [zuna-taupe.vercel.app](https://zuna-taupe.vercel.app/)

## What currently works

- Uploads PDFs with an extractable text layer and plain-text files.
- Extracts PDF text locally, in bounded batches of up to eight pages.
- Starts playback as batches arrive and prefetches the next passage while the current one
  plays.
- Provides play, pause, previous, next, seeking, playback speed, and local resume state.
- Offers the Elias and Mira UI choices. They are aliases for the male and female reference
  prompts in **one dual-voice F5 checkpoint**; they are not two separately loaded ONNX
  models. Switching the prompt does not reload the model, although the next passage still
  has to be synthesized.
- Runs the custom F5 pipeline in an ONNX Runtime Web Worker and falls back to browser
  `speechSynthesis` if local F5 narration fails.
- Keeps the selected document text, playback state, and preferences in the browser. There
  is no Zuna login, database, upload API, or server-side book processing.

## What it does not currently do

- It does not support scanned PDFs/OCR, EPUB, or arbitrary book formats.
- It does not generate an entire 500-page book before playback.
- It does not generate a 500-page book in under two minutes. A 500-page book at roughly
  300 words per page is about 1,000 minutes of speech; completing that in two minutes
  would require an RTF near 0.002. The implemented design targets **time to first audio**,
  not whole-book synthesis time.
- It does not use Kokoro or sherpa-onnx. The custom voice path is the F5 split flow-matching
  graph through ONNX Runtime Web; changing model files alone cannot make it a sherpa-onnx
  model.
- It does not use distillation, INT8, or INT4 in production. Those options were tested or
  considered and are excluded because they failed the quality gate.

## Browser inference status

The deployed package is `fp16-nfe8`: an FP16 transformer with FP32 preprocess/decode graphs,
eight flow-matching steps, and a quality-safe output limiter. The selected NFE8 configuration
passed the recorded quality checks with exact transcripts for the validation samples; NFE4
was rejected for intelligibility and speaker-identity failures.

The runtime currently:

- uses up to eight WebAssembly threads when cross-origin isolation and browser hardware
  allow it;
- uses ONNX Runtime session-level graph optimization (`all` for WASM and `basic` for a
  compatible WebGPU transformer session);
- selects WebGPU only when the adapter reports at least 11 storage buffers per shader stage;
  otherwise it uses threaded WASM;
- keeps the model and both voice prompts in one persistent worker.

WebGPU is **not working on the tested Apple M2 Max Chrome adapter**: it exposes 10 storage
buffers while the F5 transformer shader requires 11. WebGPU session initialization succeeded,
but the first transformer execution failed, so that machine uses the WASM fallback. A
permanent structural ONNX graph rewrite has not been shipped. Generic ORT optimization,
`onnxslim`, and an Identity-barrier experiment did not remove the 11-versus-10 limitation.

Measured browser baseline for a four-second passage on that Apple/Chrome setup:

- single-thread WASM: 100.954 seconds;
- threaded WASM: 30.124 seconds;
- WebGPU initialization: 2.304 seconds, followed by transformer execution failure.

These numbers are device-specific and are not a promise of production latency. The complete
performance and quality evidence is in
[`optimization/f5_tts/phases/`](optimization/f5_tts/phases/), especially the browser,
quantization, progressive-PDF, and WebGPU reports.

## Privacy and deployment boundary

Vercel serves the static HTML, JavaScript, CSS, worker, and staged model assets. The browser
downloads the model on first use and caches it locally; that download is separate from the
user's book. The book's extracted text and playback state remain client-side. A browser's
native speech fallback may have its own platform behavior, but Zuna does not send the book to
a Zuna backend.

The large model files are intentionally not tracked in Git. A fresh checkout must stage them
before local testing or deployment:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  optimization/f5_tts/scripts/stage_browser_assets.py \
  --output models/f5 \
  --vocab /Users/umangsharma/Desktop/F5-TTS/src/f5_tts/infer/examples/vocab.txt
```

The transformer is split into eight parts because Vercel rejects individual files over
100 MiB. Without the staged `models/f5` package, the UI can load but local F5 narration
cannot load its model.

## Run locally

Zuna is a zero-build static app. After staging the model assets, serve the repository over
HTTP so browser modules and workers load correctly:

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Before committing or deploying, run:

```bash
npm test
npm run check
git diff --check
```

## Deploy to Vercel

Deploy from the repository root with the staged `models/f5` directory present. Vercel is only
the static host for the current prototype; no server-side environment variables or services
are required.

```bash
npx vercel
npx vercel --prod
```

## Project structure

```text
index.html                         Browser shell and product UI
styles.css                         Visual system and responsive layout
assets/                            Artwork
app.js                             File intake, cleanup, playback, and local state
tts-worker.js                      Browser-local F5 worker
progressive-pages.mjs              Bounded PDF extraction
optimization/f5_tts/browser/       ONNX Runtime Web pipeline and smoke harnesses
optimization/f5_tts/phases/        Benchmarks, quality gates, and decision reports
models/                            Locally staged, intentionally untracked model assets
vercel.json                        Static deployment headers
TRUTH_BOARD.md                     Product decisions and guardrails
```

## Remaining work

1. Build an architecture-level F5 transformer export that fits the 10-buffer Apple WebGPU
   limit, then verify numerical parity, transcripts, speaker similarity, clipping, and
   latency before shipping it.
2. Benchmark the eight-thread WASM setting across target browsers and devices.
3. Improve PDF cleanup, chapter detection, and support for more document formats.
4. Reduce first-audio latency without sacrificing the validated voice quality.

The current success criterion is honest: a private browser reader that can begin narrating
while a document is still being extracted, with validated voices and no book upload—not a
finished high-speed whole-book renderer.
