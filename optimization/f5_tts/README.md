# Zuna F5-TTS optimization

This directory is the reproducible record for optimizing the dual-voice Zuna checkpoint.

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
```

## Baseline

Run from the Zuna repository root:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  optimization/f5_tts/scripts/benchmark_pytorch.py \
  --config optimization/f5_tts/config/pytorch-baseline.json \
  --f5-root /Users/umangsharma/Desktop/F5-TTS
```

The benchmark loads the model once, records load time separately, then measures the first
and repeated inference for both voices at fixed 4, 8, and 12-second output durations.

After Whisper writes transcripts into the run's `asr/` directory, score intelligibility,
speaker similarity, and audio integrity with:

```bash
/Users/umangsharma/Desktop/F5-TTS/ckpts/ai/bin/python \
  optimization/f5_tts/scripts/score_run.py \
  --run "$(cat optimization/f5_tts/latest-run.txt)" \
  --f5-root /Users/umangsharma/Desktop/F5-TTS
```

