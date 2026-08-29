# Security notes

## Dependency audit exception

Reviewed 2026-08-28; review again by 2026-09-30 or when Kokoro.js/Transformers.js ships an update.

`npm audit --omit=dev` reports a high-severity libvips advisory through
`kokoro-js > @huggingface/transformers > sharp@0.34.5`. There is currently no upstream fix in
that dependency range. This is not release-blocking for Zuna because the vulnerable `sharp`
image-processing path is Node-only, Zuna imports Kokoro exclusively in a browser Web Worker, and
the production browser/server bundles contain no `sharp` or `libvips` code. Do not use this
dependency to process server-side images until the advisory is resolved.

Registry signature verification passed for all 79 installed packages; 25 also provide verified
attestations.
