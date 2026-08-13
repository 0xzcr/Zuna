# PyTorch baseline

Run: `20260813T144641Z-pytorch-fp32-nfe32-mps`

## Provenance

- Checkpoint: `zuna_dual_voice_final.safetensors`
- SHA-256: `5a9bdbde8a42bfb069cd1533f5e3606839db3f40e3de04c5e3d16a345d6ca863`
- Checkpoint size: 1,348,435,761 bytes
- Runtime: PyTorch FP32, MPS, NFE 32, CFG 2.0
- Seed: 20260813
- Persistent model load: 2.322 seconds
- Peak process RSS: 3.99 GB
- MPS weights/current allocation: 1.42 GB

## Steady inference

| Voice | Reference | Output | Generation | RTF |
|---|---:|---:|---:|---:|
| Female | 4.40 s | 3.98 s | 4.829 s | 1.214 |
| Female | 4.40 s | 7.98 s | 8.253 s | 1.034 |
| Female | 4.40 s | 11.98 s | 11.683 s | 0.975 |
| Male | 7.94 s | 4.01 s | 8.062 s | 2.010 |
| Male | 7.94 s | 8.01 s | 11.390 s | 1.422 |
| Male | 7.94 s | 12.01 s | 15.245 s | 1.269 |

The longer male reference materially increases sequence length and latency. Both production
voice prompts should be reduced to approximately two seconds or replaced by distilled speaker
conditioning.

## Quality

- Whisper exact transcripts: 6/6
- Mean WER: 0.000
- Mean WavLM speaker cosine similarity: 0.945
- Audio integrity: 4/6 fully passed
- Female 8-second sample: 81 clipped samples
- Female 12-second sample: 439 clipped samples
- Male samples: no clipping, but substantially lower RMS than female samples

The optimized runtime must preserve zero WER and speaker similarity near this baseline. A
post-vocoder gain/limiter stage is required to normalize loudness and eliminate clipping.

## Next measured step

Export the same checkpoint as split FP32 ONNX graphs and require output parity before testing
FP16, lower NFE, INT8, or INT4 variants.

