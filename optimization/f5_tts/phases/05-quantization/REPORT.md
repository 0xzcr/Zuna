# Phase 5 — weight-only 8-bit and 4-bit quantization

## Gate

A candidate is accepted only when both voices retain exact Whisper transcripts and the
mean WavLM speaker cosine remains within 0.01 of the FP16 reference. Size or speed alone
cannot override this gate.

## Results

| Variant | Package size | Female CPU RTF | Male CPU RTF | Exact ASR | Mean speaker cosine | Result |
|---|---:|---:|---:|---:|---:|---|
| FP16 NFE8 | 759.8 MB | 1.652 | 1.822 | 2/2 | 0.949 | selected |
| 8-bit MatMulNBits | 496.0 MB | 1.012 | 1.105 | 0/2 | 0.318 | rejected |
| 4-bit MatMulNBits | 328.0 MB | 0.977 | 1.101 | 0/2 | 0.321 | rejected |

Both quantized transformers produced severely corrupted speech: aggregate WER was
0.971, and speaker similarity fell by about 0.63. The outputs also clipped. Therefore,
neither compressed graph is suitable for delivery despite the size and CPU speed gains.

## Decision

Keep the quality-safe FP16 transformer with FP32 preprocess/decode graphs. The rejected
artifacts and their hashes remain outside git beside the checkpoint for reproducibility;
the manifests, commands, logs, transcripts, samples, and scores are recorded here.
No model distillation is in scope.
