# Zuna

Zuna turns a readable PDF into a private, listenable audiobook—narrated locally in the browser by a small set of distinctive voices.

> Your PDFs, given a voice worth listening to.

Zuna is a quiet reading companion, not a text-to-speech utility. Drop in a PDF, choose a narrator, and start listening within seconds. Text extraction, narration, playback, and progress tracking happen on the user’s device; the PDF is never uploaded.

## The first experience

1. Open Zuna.
2. Drop in a readable PDF.
3. Zuna extracts and cleans the text locally.
4. Choose a narrator and hear the first paragraph quickly.
5. Resume later from the same place.

The first convincing prototype should support one PDF, one narrator, browser-local extraction, sentence-level playback, basic highlighting, and local resume state. It does not need accounts, cloud storage, OCR, or audio export.

## Narrator direction

The product direction is now one calm female narrator: warm, unhurried, intimate, and quietly wise. The current Elias and Mira cards are temporary prototype voices used to validate the listening flow; they are not the final trained narrator.

The final voice will be trained from a consented recording and optimized for long-form story narration.

## Product principles

- **Private by default:** “Your PDF stays on your device” should be visible at the point of upload.
- **Fast to first sound:** generate the first chunk first and continue in the background.
- **Atmospheric:** thoughtful pacing, useful pauses, clean typography, and restrained interface design.
- **Honest about capability:** launch for modern desktop browsers and readable PDFs; do not imply mobile or scanned-PDF support yet.
- **No account required:** a first listen should work without signup.

## MVP

Browser PDF upload, local text extraction and cleanup, one local narrator model, sentence or paragraph chunking, play/pause/seek, playback speed, current-text highlighting, resume position, IndexedDB progress, and a responsive desktop interface.

Later candidates include chapter detection, bookmarks, sleep timer, dark mode, voice previews, model download progress, and a continue-listening screen. Cloud storage, OCR, voice cloning, social sharing, audiobook export, and accounts before first use are out of scope for version one.

## Suggested architecture

The static frontend hosts the interface. PDF.js extracts text in the browser, a cleanup/chunking layer prepares narration, and a Web Worker runs the quantized Kokoro ONNX model through WASM. Web Audio API handles playback; IndexedDB or OPFS can store local progress and cached audio.

## Browser prototype

Open `index.html` through a local server to try the first vertical slice. It supports readable PDF or text-file intake, local text cleanup, sentence passages, two narrator personas, browser-local speech preview, playback controls, and local resume state.

The browser prototype currently uses Kokoro-82M through `kokoro-js` in a Web Worker. The quantized ONNX model is fetched on first use, cached by the browser, and run locally with WASM. The browser Web Speech API remains a fallback for unsupported browsers.

Kokoro is an open-weight 82M TTS model. The browser-ready ONNX model is Apache-2.0 licensed and exposes multiple English voices. It is the only narrator currently attached to the frontend.

The model reference is `onnx-community/Kokoro-82M-v1.0-ONNX`; the browser package is pinned to `kokoro-js@1.2.1`. The app uses the `q8` model variant to balance quality and first-download size.

## Model status

The custom narrator model is currently being trained and optimized separately from the frontend. The target is a small browser-compatible ONNX/WebAssembly voice model trained on a consented female voice recording and tuned for calm, long-form narration.

The model is not bundled with this repository and is not attached to the frontend yet. Before integration, it must pass voice quality, pronunciation, chapter-transition, model-size, browser-memory, and time-to-first-audio checks.

PDF story examples will be used to validate text cleanup and narration behavior. They only become TTS training data when paired with matching voice recordings and transcripts.

## Project structure

```text
index.html       Browser shell and product UI
styles.css       Visual system and responsive layout
app.js           PDF extraction, cleanup, playback, and progress state
tts-worker.js    Browser-local TTS worker
README.md        Product scope and model status
HANDOFF.md       Engineering handoff
TRUTH_BOARD.md   Decisions, hypotheses, and guardrails
```

## Success signal

The activation event is a user listening to at least 60 seconds of their own PDF. The first prototype succeeds when a user can upload, hear the first paragraph quickly, listen for five minutes, close the browser, reopen Zuna, and resume.
