# Phase 9 — progressive PDF narration

PDF.js now extracts at most eight pages in parallel and publishes each completed batch
immediately. Playback can begin from the first batch while the remaining pages continue
to parse, and opening another document cancels publication from the stale extraction.
The bounded batch prevents a 500-page book from creating 500 simultaneous page tasks.

A synthetic 500-page orchestration check published its first eight pages in 0.054 ms and
processed all 63 batches in 73.9 ms; real time is dominated by PDF.js text extraction,
not this queue. The product target should therefore be **under two minutes to first
audio**, not under two minutes to synthesize the entire book.

At 300 words/page and 150 spoken words/minute, 500 pages contain about 150,000 words and
produce about 1,000 minutes (16.7 hours) of audio. Completing that audio in two minutes
would require an RTF near 0.002. The quality-safe native NFE8 runs around RTF 0.2 and the
measured browser WASM fallback around RTF 25, so whole-book generation in two minutes is
mathematically impossible with this checkpoint and current runtime.
