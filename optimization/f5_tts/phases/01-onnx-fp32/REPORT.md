# Phase 1 — FP32 ONNX parity

Status: **passed**

## Export

- Exporter: `DakeQQ/F5-TTS-ONNX@47173d5fe22eefd1adc4dab3b8829d227f307e29`
- F5 series: v0 (`F5TTS_Base`)
- Opset: 20
- Precision: FP32
- NFE: 32
- Total graph size: 1,422,698,909 bytes
- All four graphs passed `onnx.checker`.
- Full artifact paths, sizes, shapes, metadata, and SHA-256 hashes are in `artifact-manifest.json`.

The ONNX binaries remain beside the checkpoint at:

`/Users/umangsharma/Desktop/F5-TTS/ckpts/zuna_dual_voice_v3/onnx/fp32-nfe32`

## Quality gate

| Voice | PyTorch speaker cosine | ONNX speaker cosine | ONNX WER | Result |
|---|---:|---:|---:|---|
| Female | 0.924 | 0.948 | 0.000 | Pass |
| Male | 0.963 | 0.964 | 0.000 | Pass |

Both transcripts are exact and neither voice loses speaker similarity. The split export therefore
passes functional parity against the recorded PyTorch baseline.

## CPU reference timing

| Voice | Audio | Inference | RTF |
|---|---:|---:|---:|
| Female | 8.01 s | 69.69 s | 8.700 |
| Male | 8.01 s | 96.93 s | 12.101 |

These CPU timings are recorded only as an ONNX reference. Browser performance will be measured
with WebGPU after precision and step-count tuning.

## Observations carried forward

- The 7.94-second male reference increases sequence cost substantially.
- Both ONNX samples contain a small number of clipped samples; the later shared output limiter
  remains mandatory.
- No precision reduction or quantization was applied in this phase.

