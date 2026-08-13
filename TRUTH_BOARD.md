# Zuna truth board

This is the current source of truth for product decisions. A statement is only a **truth** when it is an explicit decision or verified behavior. Everything else stays marked as a hypothesis until tested.

## Truths — decided now

| Area | Truth |
| --- | --- |
| Promise | Zuna gives PDFs a voice worth listening to. |
| Core experience | A user drops in a readable PDF, chooses a narrator, and starts listening within seconds. |
| Privacy | PDFs remain on the user’s device. Processing is local in the browser. |
| Identity | Zuna should feel like a quiet reading companion, not a utility. |
| Voices | The product target is one calm, warm female narrator; Elias and Mira are temporary prototype cards. |
| First listen | No account is required before the first listen. |
| Platform | The initial target is the modern desktop browser. |
| Activation | Listening to at least 60 seconds of a user’s own PDF is the first meaningful success event. |
| Prototype boundary | One PDF, one narrator, local extraction, sentence playback, highlighting, and resume state are enough to validate the idea. |
| Browser narrator | The validated dual-voice F5 ONNX package runs in a persistent Web Worker through threaded WASM, with WebGPU selected when compatible. Elias maps to the male prompt and Mira to the female prompt. |
| Browser fallback | Web Speech remains available when the local model cannot load. |
| Model status | The optimized F5 narrator is attached to the frontend and deployed with Vercel-compatible transformer shards. |
| Browser constraint | The final narrator must run locally in the browser through ONNX/WebAssembly or an equivalent browser runtime. |
| Chapter start | Chapter detection belongs in the PDF parser; it should not be learned by the TTS model. |

## Hypotheses — need evidence

| Hypothesis | Evidence needed | Smallest test |
| --- | --- | --- |
| People want to listen to PDFs while walking or doing routine work. | Users independently describe this use case and return to it. | 5 user tests with a real PDF and a 10-minute listening task. |
| Distinctive narrator personalities matter more than generic voice labels. | Users remember and prefer Elias or Mira by name. | Compare named cards with “Old Man/Old Woman” labels. |
| Hearing the first paragraph quickly is essential to activation. | Faster first audio improves completion and 60-second listening. | Measure upload-to-first-audio time and drop-off. |
| Local processing increases trust and willingness to upload sensitive documents. | Users notice and value the privacy message. | A/B test privacy copy at upload; ask post-task trust questions. |
| Sentence-level highlighting is sufficient for the first prototype. | Users can follow along without needing word-level sync. | Observe five users reading/listening simultaneously. |
| Desktop browser performance is acceptable for local narration. | Typical laptops can generate audio ahead of playback. | Test representative PDFs and record time-to-first-audio plus buffer underruns. |

## Non-negotiable guardrails

- Do not upload document contents to a narration server.
- Do not promise scanned-PDF OCR in the first release.
- Do not make users wait for the entire document before playback begins.
- Do not hide model download time; show progress when it is material.
- Do not lead with “text-to-speech” language when describing the emotional product.

## Open decisions

- Does the F5 first-download and generation time meet the target across supported desktop browsers?
- What PDF cleanup rules remove repeated headers and page numbers without damaging meaningful content?
- Should progress resume at the last sentence, paragraph, or timestamp within generated audio?
- What is the minimum acceptable offline behavior after a model has been downloaded?

## Next validation pass

1. Build the one-PDF/one-voice prototype.
2. Instrument upload-to-first-audio, 60-second listening, five-minute completion, and resume success.
3. Test with research, business, literary, and private documents.
4. Use those results to promote or reject hypotheses before expanding scope.
