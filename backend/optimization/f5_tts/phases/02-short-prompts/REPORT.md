# Phase 2 — Compact voice prompts

Status: **passed**

## Selected prompts

| Voice | Original | Selected | Text |
|---|---:|---:|---|
| Female | 4.40 s | 2.18 s | You begin to pull away from Mars. |
| Male | 7.94 s | 2.82 s | the words on the page came alive. |

The deployable prompt WAVs and their hashes are stored in `../../assets/voice-prompts/`.

## Quality gate

| Voice | Original-prompt speaker cosine | Compact-prompt speaker cosine | WER |
|---|---:|---:|---:|
| Female | 0.924 | 0.956 | 0.000 |
| Male | 0.963 | 0.961 | 0.000 |

The rejected 2.26-second male candidate scored 0.796 against the canonical voice. Three additional
male candidates were generated and scored; the selected 2.82-second prompt was the only compact
candidate that preserved the baseline identity within 0.002 cosine.

## MPS latency at NFE 32

| Voice | Original prompt | Compact prompt | Improvement |
|---|---:|---:|---:|
| Female, 8 s output | 8.253 s | 6.959 s | 15.7% |
| Male, 8 s output | 11.390 s | 7.396 s | 35.1% |

Both selected samples have exact Whisper transcripts and no clipping. The compact prompts pass
the quality gate and become the fixed references for subsequent NFE, precision, ONNX, and browser
benchmarks.

