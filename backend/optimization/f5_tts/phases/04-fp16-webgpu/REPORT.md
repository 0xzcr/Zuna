# Phase 4 — FP16 WebGPU candidate

Status: **passed for export and quality**

## Artifact

- Transformer precision: FP16
- Preprocess/decode precision: FP32
- NFE: 8
- Opset: 20
- Total graph size: 759,819,212 bytes
- FP32 graph size: 1,422,698,909 bytes
- Size reduction: 46.6%
- All graphs passed `onnx.checker`.
- Transformer initializers: 186 FP16, zero FP32

The large binaries and their committed manifest are located at:

`/Users/umangsharma/Desktop/F5-TTS/ckpts/zuna_dual_voice_v3/onnx/fp16-nfe8`

## Quality gate

| Voice | WER | Speaker cosine |
|---|---:|---:|
| Female | 0.000 | 0.960 |
| Male | 0.000 | 0.938 |

Both transcripts are exact and mean speaker cosine is 0.949, exceeding the original PyTorch
baseline mean of 0.945. FP16 therefore causes no measured quality regression.

## ONNX CPU reference

| Voice | Audio | Inference | RTF |
|---|---:|---:|---:|
| Female | 8.01 s | 13.23 s | 1.652 |
| Male | 8.01 s | 14.60 s | 1.822 |

CPU FP16 is recorded only as a compatibility reference. The transformer is intended for WebGPU.

## Browser preparation

- `onnxruntime-web@1.27.0` is pinned in the project.
- `browser/webgpu-compat.html` checks session initialization by loading the FP16 transformer
  with WebGPU only, while preprocess and decode use WASM.
- The same harness will become the persistent inference worker in the browser-runtime phase.

Phase 7 later confirmed that initialization succeeds but actual transformer execution exceeds
the tested Apple/Chrome adapter's storage-buffer-per-shader limit; initialization alone is not
an inference pass.

Output clipping remains visible and will be corrected by the shared limiter phase.
