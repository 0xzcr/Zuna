# Phase 3 — NFE and CFG sweep

Status: **passed**

Selected configuration: **NFE 8, CFG 2.0, sway -1.0**

## Sweep result

| Variant | Female RTF | Male RTF | Exact transcripts | Result |
|---|---:|---:|---:|---|
| NFE 16, CFG 2.0 | 0.413 | 0.402 | 2/2 | Pass, slower |
| NFE 8, CFG 2.0 | 0.194 | 0.223 | 2/2 | **Selected** |
| NFE 8, CFG 1.5 | 0.214 | 0.232 | 2/2 | No speed benefit |
| NFE 4, CFG 2.0 | 0.108 | 0.114 | 0/2 | Reject |
| NFE 4, CFG 1.5 | 0.109 | 0.115 | 0/2 | Reject |
| NFE 4, CFG 1.0 | 0.109 | 0.122 | 0/2 | Reject |

Reducing CFG does not reduce the model's two-branch classifier-free-guidance compute and produced
no measured speed benefit. NFE 4 caused severe intelligibility and speaker-identity failures, so
it is permanently excluded.

## Six-sample validation

NFE 8 was validated for both voices at 4, 8, and 12-second output durations:

- Whisper exact transcripts: 6/6
- Mean WER: 0.000
- Mean speaker cosine: 0.940
- NFE 32 baseline mean speaker cosine: 0.945
- Mean speaker-cosine change: -0.0055

The average identity change is below 0.01, every transcript is exact, and every per-sample speaker
score remains at least 0.919. NFE 8 therefore passes the quality gate.

## Selected MPS latency

| Voice | 4-second output | 8-second output | 12-second output |
|---|---:|---:|---:|
| Female | 1.452 s | 1.552 s | 2.259 s |
| Male | 1.179 s | 1.650 s | 2.566 s |

The 4-second startup chunks already complete below two seconds. FP16 and WebGPU remain necessary
to bring sustained browser RTF safely below 0.20 across both voices.

