# Zuna implementation handoff

## Current state

Zuna now has a dependency-light static browser prototype. The product direction is defined in `README.md` and `TRUTH_BOARD.md`.

The browser prototype is split across `index.html`, `styles.css`, `app.js`, and `tts-worker.js`. It uses Kokoro-82M through `kokoro-js` in a Web Worker; the browser Web Speech API remains a fallback. The target custom model is being trained and optimized separately and is not attached yet.

Working folder:

```text
/Users/umangsharma/Desktop/Zuna
```

## Product goal

Zuna turns readable PDFs into private, listenable audiobooks. PDF extraction, narration, playback, and progress tracking should happen locally in the browser. The PDF must not be uploaded.

## Current implementation milestone

The first local ONNX engine is now wired:

1. Text input.
2. Kokoro-82M loaded as an ONNX model.
3. ONNX Runtime Web WASM inference through `kokoro-js`.
4. Inference running in a Web Worker.
5. Generated audio played in the browser.
6. Basic timing measurements.

The temporary prototype narrator mapping is:

- Elias: Kokoro `bm_fable`, with a measured speed multiplier for long-form narration.
- Mira: Kokoro `af_heart`, with a gentle speed multiplier for story delivery.

These are temporary product personas, not custom voices or claims about real people.

## Model status

The intended production narrator is one calm female voice trained from a consented recording. The model work is intentionally separate from this frontend submission until the browser-compatible model, voice quality, and long-form behavior are validated.

PDFs are input to the document parser. They are not voice-training data unless the same text is paired with matching narrator audio and transcripts.

## Recommended browser architecture

```text
Text input
    ↓
Web Worker
    ↓
Kokoro-82M ONNX / ONNX Runtime Web WASM
    ↓
Audio buffer
    ↓
Browser playback
```

The current browser model is the Apache-2.0 `onnx-community/Kokoro-82M-v1.0-ONNX` model, loaded as `q8` through the pinned `kokoro-js@1.2.1` browser bundle. Kokoro’s published JavaScript API supports WASM/WebGPU, browser caching, and multiple voices.

The final model option remains open, with browser-compatible ONNX/WebAssembly inference required.

References:

- https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX
- https://www.npmjs.com/package/kokoro-js
- https://k2-fsa.github.io/sherpa/onnx/tts/wasm/build.html

## What comes after the browser TTS proof

Implement in this order:

1. PDF upload with PDF.js.
2. Local text extraction.
3. Repeated-header and page-number cleanup.
4. Sentence-sized chunking.
5. Generate the first chunk immediately.
6. Generate later chunks in the background.
7. Highlight the active sentence.
8. Save resume state in IndexedDB.
9. Compare Elias and Mira on real long-form PDFs.
10. Add model download progress and local caching polish.

Do not start with voice training, OCR, accounts, cloud storage, or full-document conversion.

## Browser proof acceptance criteria

The milestone is complete when:

- A user can type text and hear it locally in the browser.
- Inference runs outside the main UI thread.
- The UI remains responsive while audio is generated.
- The model is downloaded only when selected.
- The generated audio plays without requiring a server-side TTS API.
- Model size, time to first audio, generation time, and audio duration are recorded.

## Important constraints

- Start with modern desktop browsers: Chrome, Edge, and Safari where performance is acceptable.
- Use short sentence or paragraph chunks; never synthesize an entire PDF at once.
- Cache downloaded models locally after the first download.
- Check the license of each model and its source dataset before commercial distribution. Kokoro’s published ONNX model is Apache-2.0; custom actor voices will require separate consent and licensing.
- Keep the privacy message visible: **Your PDF stays on your device.**
