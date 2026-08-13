# Phase 7 — persistent browser runtime

## Implemented

`browser/f5-runtime.mjs` implements the exported three-graph F5 pipeline, holds all
sessions and both compact prompts in one worker, performs eight flow-matching steps,
applies the quality-safe output ceiling, and writes playable PCM16 WAV. The staging
script copies the selected external model, vocabulary, and prompts into a clean static
deployment tree.

## Measured browser result

Chrome 152 on Apple arm64 loaded the FP16 transformer on WebGPU plus the two WASM graphs
in 2.304 seconds. Actual transformer execution then failed because the adapter exposes a
maximum of 10 storage buffers per shader while ONNX Runtime Web's generated F5 Gemm
shader requires 11. FP32 has the same limit. The runtime now checks this adapter limit
before loading and selects WASM rather than crashing.

The complete 4-second WASM fallback run passed in 100.954 seconds. Its transcription was
exact, WavLM speaker cosine was 0.948, and it had no clipped samples. This is functional
and quality-safe, but it is not fast enough for the intended product.

## sherpa-onnx boundary

sherpa-onnx provides browser WASM TTS, but its public TTS engine contracts cover models
such as VITS/Piper, Matcha, and Kokoro rather than this F5 split flow-matching graph. The
custom F5 checkpoint therefore runs through ONNX Runtime Web; using sherpa-onnx would
require adding a new F5 engine to sherpa-onnx itself, not merely changing model files.

References: [sherpa-onnx TTS documentation](https://k2-fsa.github.io/sherpa/onnx/tts/index.html),
[ONNX Runtime WebGPU documentation](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html).
