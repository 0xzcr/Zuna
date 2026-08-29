# Implementation Plan: Zuna Website Redesign

## Overview

Recompose the Zuna website around its working local reading pipeline while borrowing MetaMask's current visual qualities: a confident oversized hero, dark editorial surfaces, clear product pillars, strong section rhythm, and art-led cards. The reader behavior and backend remain unchanged.

## Architecture Decisions

- Keep the existing DOM IDs and data attributes consumed by `frontend/app.js`; redesign the React shell and CSS around those contracts.
- Use local static abstract art assets from the Unsplash free-license results, with attribution in the repository documentation, so the website has no runtime image dependency.
- Keep animation dependency-free with CSS motion, one Intersection Observer, and reduced-motion fallbacks.
- Remove inactive membership/marketing actions rather than redesigning them as fake functionality.

## Task List

### Phase 1: Foundation

- [x] Task 1: Add and document local abstract art assets.
- [x] Task 2: Define the MetaMask-inspired Zuna visual system and responsive layout tokens.

### Checkpoint: Foundation

- [x] Existing reader DOM contracts remain present.
- [x] No backend files or runtime endpoints change.

### Phase 2: Core Website Recomposition

- [x] Task 3: Remove navigation and recompose the hero, library, voice, privacy, player, and settings surfaces as one scrolling story.
- [x] Task 4: Apply the new art-led cards, motion, and responsive styling.

### Checkpoint: Core Features

- [x] Import, saved-book reopen, voice selection, chapter selection, playback, theme, and settings remain usable.

### Phase 3: Polish

- [x] Task 5: Verify browser states, accessibility, mobile layout, tests, and production build.
- [x] Task 6: Review, document, and commit the redesign.

### Checkpoint: Complete

- [x] All acceptance criteria met.
- [x] No backend changes.
- [x] Ready for user review.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| React shell changes break imperative reader bindings | High | Preserve every existing reader ID and data attribute; verify in a real browser. |
| Large art assets slow first paint | Medium | Use compressed local images with explicit dimensions and `loading="lazy"` for below-fold art. |
| Motion hurts accessibility or battery | Medium | Keep motion subtle and disable it under `prefers-reduced-motion`. |

## Open Questions

- None blocking. The redesign uses MetaMask as a visual reference, not a copy of its branding or content.
