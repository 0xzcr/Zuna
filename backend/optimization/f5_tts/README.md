# Zuna F5-TTS optimization

This directory is the reproducible record for optimizing the dual-voice Zuna checkpoint.
It is offline model-development work, not a runtime backend service. Browser model runtime
code lives under `backend/model_runtime/f5/` and is imported by the thin frontend worker.

## Selected configuration

- one dual-voice F5 checkpoint; no model distillation
- compact female and male prompts loaded into one persistent runtime
- FP16 transformer with FP32 preprocess/decode graphs
- NFE 8, CFG 2, sway -1
- attenuation-only -1 dBFS output ceiling
- ONNX Runtime Web: WebGPU when the adapter supports the required 11 storage buffers,
  otherwise quality-safe WASM
- progressive eight-page PDF extraction and queued audio scheduling

Weight-only 8-bit and 4-bit exports are retained only as rejected experiments because
they destroyed intelligibility and speaker identity.

## Layout

```text
config/                 Versioned benchmark inputs
scripts/                Reproducible benchmark and scoring tools
runs/<run-id>/           Immutable output from one benchmark run
  config.json            Exact configuration snapshot
  environment.json       Hardware, software, git, and checkpoint provenance
  metrics.json           Timings and audio measurements
  benchmark.log          Complete console log
  samples/               Generated WAV files
  asr/                   Whisper transcripts
phases/                  Reports, manifests, logs, samples, and quality decisions

The browser model runtime and smoke harnesses are in `backend/model_runtime/f5/`.
```

## Baseline

Run from the Zuna repository root:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  backend/optimization/f5_tts/scripts/benchmark_pytorch.py \
  --config backend/optimization/f5_tts/config/pytorch-baseline.json \
  --f5-root /Users/umangsharma/Desktop/F5-TTS
```

The benchmark loads the model once, records load time separately, then measures the first
and repeated inference for both voices at fixed 4, 8, and 12-second output durations.

After Whisper writes transcripts into the run's `asr/` directory, score intelligibility,
speaker similarity, and audio integrity with:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  backend/optimization/f5_tts/scripts/score_run.py \
  --run "$(cat backend/optimization/f5_tts/latest-run.txt)" \
  --f5-root /Users/umangsharma/Desktop/F5-TTS
```
