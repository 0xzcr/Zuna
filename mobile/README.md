# Zuna mobile

React Native / Expo shell for the guest-first Zuna app. The current slice provides the mobile
navigation, local-library entry point, narrator selection, player state, and explicit Kokoro
integration seam. It does not yet claim to parse PDFs or generate Kokoro audio; those are the
next Phase 1 native pipeline tasks.

Install and run from this directory:

```bash
npm install
npx expo start
```

The first import path uses the native document picker and keeps the selected asset local. The
Kokoro engine is represented by `src/narration-engine.ts` so wiring ONNX does not accidentally
replace the specified free-tier backend with a different TTS vendor.
