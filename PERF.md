# Zuna performance ledger

Measurements were taken locally on 2026-08-27. Re-run them after pipeline or dependency changes.

| Measurement | Before | Next.js result | Verdict |
| --- | ---: | ---: | --- |
| Narration requests for 100 representative sentences | 100 | 7 | Kept: 93% fewer Kokoro round trips |
| Warm local HTML TTFB | 2.75 ms | 1.84–3.83 ms | Kept: within local noise |
| Cold Kokoro voice discovery through web server | 22.7 ms / failed when runtime absent | 12.7 ms / 54 voices | Kept: working same-origin route |
| Cold short Kokoro synthesis | Not available in baseline | 1.84 s | Passes the 30–45 s first-audio budget |
| Cached book reopen in a real browser | Not supported | 21 ms | Kept |
| Cached audio play interaction in a real browser | Not supported | 402 ms including automation overhead | Kept |
| Repeated chapter-map work for a synthetic 1,000-page PDF | 2,918 ms at every 4 pages | 720 ms at every 16 pages | Kept: 75% less main-thread work |
| Initial production JavaScript | 17.6 KB raw legacy app JS | 177 KB gzip Next.js/React | Accepted framework cost; under 200 KB budget |

The first narration chunk targets 280 characters, later chunks target 900, and no chunk exceeds
1,200 characters. PDF extraction reads four pages at a time, publishes the first readable batch
immediately, then refreshes chapter discovery every sixteen pages. PDF.js and EPUB decompression
are loaded only when their file type is selected.
