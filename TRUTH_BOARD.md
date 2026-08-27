# Zuna truth board

This is the current source of truth for product decisions. A statement is only a **truth** when it is an explicit decision or verified behavior. Everything else stays marked as a hypothesis until tested.

## Truths — decided now

| Area | Truth |
| --- | --- |
| Promise | Zuna gives readable books a voice worth listening to. |
| Core experience | A user drops in a readable PDF or TXT file, chooses a narrator, and starts listening. |
| Privacy | Documents remain on the user’s device. Processing is local in the browser. |
| First listen | No account is required before the first listen. |
| Platform | The initial target is the modern desktop browser. |
| Browser narrator | Narration uses the local Kokoro-82M runtime through same-origin Next.js routes. All discovered voices are free. |
| Prototype boundary | Local extraction, chapter navigation, bounded narration chunks, persistent caching, and resume state validate the reading idea. |

## Hypotheses — need evidence

| Hypothesis | Evidence needed | Smallest test |
| --- | --- | --- |
| People want to listen to PDFs while walking or doing routine work. | Users independently describe this use case and return to it. | 5 user tests with a real PDF and a 10-minute listening task. |
| Distinctive narrator personalities matter more than generic voice labels. | Users remember and prefer narrator choices by name. | Compare named cards with descriptive voice labels. |
| Hearing the first paragraph quickly is essential to activation. | Faster first audio improves completion and 60-second listening. | Measure upload-to-first-speech time and drop-off. |
| Local processing increases trust and willingness to upload sensitive documents. | Users notice and value the privacy message. | A/B test privacy copy at upload; ask post-task trust questions. |
| Sentence-level highlighting is sufficient for the first prototype. | Users can follow along without word-level sync. | Observe five users reading and listening simultaneously. |

## Non-negotiable guardrails

- Do not upload document contents to a hosted narration server.
- Do not promise scanned-PDF OCR in the first release.
- Do not make users wait for the entire document before playback begins.
- Do not hide local-runtime availability or platform differences.

## Open decisions

- Which native browser voices provide the best experience across supported devices?
- What PDF cleanup rules remove repeated headers and page numbers without damaging meaningful content?
- Should progress resume at the last sentence, paragraph, or timestamp within speech playback?
- What is the minimum acceptable offline behavior?
