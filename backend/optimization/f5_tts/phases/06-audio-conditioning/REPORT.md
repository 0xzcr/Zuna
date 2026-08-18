# Phase 6 — quality-safe audio conditioning

The browser applies one transparent operation before WAV encoding: if the raw float
waveform exceeds -1 dBFS, every sample is multiplied by the same gain. Audio already
below the ceiling is returned unchanged. There is no compressor, makeup gain, EQ, or
per-voice processing.

Both validation samples required a 0.891251 gain. They retained exact Whisper
transcriptions (2/2), retained the FP16 mean WavLM speaker cosine of 0.949, and reduced
samples at or above 0.999 from both outputs to zero. The operation therefore passes the
quality and integrity gates.

The browser implementation and its Node tests are in `browser/audio-postprocess.mjs`;
`scripts/normalize_audio.py` mirrors it for offline validation.
