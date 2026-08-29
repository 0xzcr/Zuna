# Zuna performance ledger

Measurements were taken locally on 2026-08-27. Re-run them after pipeline or dependency changes.

| Measurement | Before | Next.js result | Verdict |
| --- | ---: | ---: | --- |
| Narration requests for 100 representative sentences | 100 | 7 | Kept: 93% fewer Kokoro round trips |
| Warm local HTML TTFB | 2.75 ms | 1.84–3.83 ms | Kept: within local noise |
| Hosted Kokoro availability | Failed because Vercel called `127.0.0.1:8766` | Browser worker; no server dependency | Kept: narration now works on deployed builds |
| Warm Kokoro startup | Server connection required | 2.9 s from reload to 28 ready voices on cached q8 WASM | Kept |
| Uncached first audio after an immediate voice/chapter switch | Not available in deployed build | 19.8 s on q8 WASM, including a 2.9 s worker restart | Accepted fallback; WebGPU is preferred and background generation hides steady-state work |
| Cached play interaction | Not available in deployed build | 2.3 s including browser automation/audio start | Kept |
| Cached book reopen in a real browser | Not supported | 21 ms | Kept |
| Cached audio play interaction in a real browser | Not supported | 402 ms including automation overhead | Kept |
| Repeated chapter-map work for a synthetic 1,000-page PDF | 2,918 ms at every 4 pages | 720 ms at every 16 pages | Kept: 75% less main-thread work |
| Initial production JavaScript | 17.6 KB raw legacy app JS | 171.9 KB gzip Next.js/React | Speech worker remains lazy; under 200 KB budget |

The first narration chunk targets 180 characters, later chunks target 600, and no chunk exceeds
800 characters. Three following chunks are prefetched and the immediate next audio element is
preloaded for continuous playback. PDF extraction reads four pages at a time, publishes the first readable batch
immediately, then refreshes chapter discovery every sixteen pages. PDF.js and EPUB decompression
are loaded only when their file type is selected.
