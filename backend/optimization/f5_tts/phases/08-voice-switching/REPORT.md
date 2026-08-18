# Phase 8 — instant voice selection and gapless scheduling

Both compact prompts are decoded into memory when the one persistent runtime loads.
Changing narrator therefore changes only the prompt key captured by the next queued job;
it does not recreate or reload any ONNX session. The queue serializes jobs because ONNX
Runtime Web should not execute this large model concurrently.

`GaplessPlayer` schedules already-generated chunks on one Web Audio timeline, avoiding a
playback boundary when inference stays ahead of listening. Voice selection itself is
synchronous and covered by tests. A newly selected passage still has to be synthesized;
with the measured Apple/Chrome WASM fallback this generation time remains the limiting
factor and cannot truthfully be described as an instant first sample.

The product player also prefetches the next passage while the current audio is playing,
so the normal passage boundary is no longer forced to wait for a fresh model request.
