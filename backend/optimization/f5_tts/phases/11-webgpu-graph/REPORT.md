# Phase 11 — browser execution tuning

## Shipped

- WASM thread cap increased from 4 to 8, bounded by `navigator.hardwareConcurrency`.
- WebGPU transformer sessions now use ORT's `basic` graph optimization level instead of
  `all`, avoiding unnecessary fusion when a compatible adapter is available.

## Compatibility result

The tested Apple M2 Max adapter reports 10 storage buffers per shader stage. The F5
transformer still requires 11 during its first transformer run. ORT 1.27, ORT `dev`,
`onnxslim`, disabled/basic graph optimization, and a MatMul identity-barrier candidate
all reproduced the same limit. The candidate graphs are therefore not deployed.

The runtime continues to select threaded WASM on this adapter. NFE4 is not enabled:
the existing quality sweep rejected it with 0/2 exact transcripts.

The next real WebGPU step is an architecture-level export that splits the offending
transformer operation, followed by voice and transcript parity checks.
