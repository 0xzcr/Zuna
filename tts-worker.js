import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
let narrator;
let loading;
let pendingRequest;
let processing = false;

function reportProgress(progress) {
  self.postMessage({
    type: 'progress',
    progress: typeof progress?.progress === 'number' ? progress.progress : undefined,
    file: progress?.file,
  });
}

async function loadNarrator() {
  if (narrator) return narrator;
  if (!loading) {
    loading = KokoroTTS.from_pretrained(MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: reportProgress,
    }).then((model) => {
      narrator = model;
      self.postMessage({ type: 'ready' });
      return model;
    });
  }
  return loading;
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (pendingRequest) {
      const request = pendingRequest;
      pendingRequest = undefined;
      try {
        const model = await loadNarrator();
        const audio = await model.generate(request.text, {
          voice: request.voice,
          speed: request.speed,
        });
        const wav = audio.toWav();
        self.postMessage({ type: 'audio', requestId: request.requestId, wav }, [wav]);
      } catch (error) {
        self.postMessage({ type: 'error', requestId: request.requestId, message: error?.message || String(error) });
      }
    }
  } finally {
    processing = false;
  }
}

self.onmessage = ({ data }) => {
  if (data?.type === 'cancel') {
    pendingRequest = undefined;
    return;
  }
  if (data?.type !== 'speak') return;
  // Keep only the newest requested passage. Kokoro/WASM should not be run concurrently.
  pendingRequest = data;
  processQueue();
};
