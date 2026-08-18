# Backend and model work

Zuna currently has no runtime backend service. Book extraction, narration, playback, and
local state run in the browser frontend.

This folder contains all model-related work: the browser F5 runtime, staged model assets,
voice prompts, F5-TTS benchmark inputs, export and staging scripts, quality reports, and
rejected optimization experiments. The frontend only contains the product UI and a thin
worker bridge into this model runtime.

The current checkpoint is retained as a baseline. The next model iteration should be lighter
and must pass the existing transcript, speaker-similarity, clipping, and browser-latency gates
before replacing it.
