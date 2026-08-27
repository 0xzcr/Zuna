# Implementation Plan: Zuna cozy reader UI

## Overview

Refresh the existing static Zuna reader into a clean, dreamy, cozy local-first reading experience with a responsive library shell, light/dark themes, and a persistent player while preserving the current local PDF/TXT extraction and browser speech functionality.

## Architecture decisions

- Keep the zero-build static app and existing browser APIs; no new UI dependency is needed.
- Use CSS custom properties for theme tokens so light/dark mode is one shared design system.
- Keep document import, passage extraction, playback, and localStorage behavior in `frontend/app.js`; the UI refresh should not split business logic across duplicate clients.
- Use the existing supplied artwork as a restrained book-cover/ambient accent, not as a full-page background, so readable content stays calm in both themes.

## Task list

### Phase 1: Foundation

- [x] Task 1: Rebuild the page shell and library/player hierarchy around the existing local reader flow.
- [x] Task 2: Add a semantic light/dark theme system with persisted preference and accessible controls.

### Checkpoint: UI foundation

- [x] Existing file import and playback interactions remain functional.
- [x] Desktop and mobile layouts are usable at responsive breakpoints.
- [x] `npm test` and `npm run check` pass.

### Phase 2: Interaction polish

- [ ] Task 3: Add richer empty/library states, compact player affordances, and responsive navigation treatment.
- [ ] Task 4: Verify visual output and accessibility, then fix regressions.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Browser speech voices vary by device | Medium | Keep the existing fallback behavior and expose the local engine state in the UI. |
| Existing artwork is visually intense | Medium | Limit it to a framed cover/ambient glow with theme-aware overlays. |
| Static app has no component framework | Low | Prefer semantic HTML, CSS tokens, and small event handlers over adding a dependency. |

## Open questions

- Final brand mark and artwork direction can be refined after the first visual pass.
- EPUB/Kokoro/Sarvam remain later product phases and are not part of this UI slice.
