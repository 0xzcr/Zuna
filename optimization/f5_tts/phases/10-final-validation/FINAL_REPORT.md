# Final optimization decision

## Quality-safe selected path

- Dual-voice checkpoint with compact female and male prompts.
- NFE 8, CFG 2, sway -1.
- FP16 transformer plus FP32 preprocess/decode.
- Attenuation-only -1 dBFS peak normalization.
- One persistent runtime and one serialized inference queue.
- Eight-page progressive PDF extraction.
- Audio prefetch during playback to overlap synthesis with listening.

## Speed results

| Path | Measured result |
|---|---:|
| PyTorch MPS, NFE8, compact prompt | female RTF 0.194; male RTF 0.223 |
| Browser WebGPU session initialization | 2.304 s |
| Browser single-thread WASM, 4-second chunk | 100.954 s |
| Browser threaded WASM, 4-second chunk | 30.124 s |

Threaded WASM is the tested deployment fallback and keeps exact transcription and voice
quality. WebGPU execution is currently blocked on the tested Apple adapter: the F5 Gemm
shader requires 11 storage buffers and Chrome exposes 10. The runtime detects this before
loading and selects WASM. A future WebGPU graph rewrite or a device with the required
limit is the remaining route to substantially lower latency.

## Quantization decision

Weight-only 8-bit and 4-bit candidates were rejected: both produced aggregate WER 0.971,
mean speaker cosine about 0.32, and clipping. FP16 is the smallest validated artifact.
No distillation is included.

## Target interpretation

The achievable target is under two minutes to first playable audio for the tested 4-second
chunk on threaded WASM. Generating the entire 500-page book in two minutes is impossible
for this model: at 300 words/page and 150 words/minute it represents about 1,000 minutes
of audio, requiring RTF approximately 0.002.
