import { KokoroTTS } from 'kokoro-js';
import { KOKORO_MODEL_ID, kokoroModelOptions } from './kokoro-runtime.mjs';

let modelPromise;
let activeBackend = '';
let activeGeneration = 0;
const requestQueue = [];
let draining = false;
const voiceWarmups = new Map();
const KOKORO_VOICE_ORIGIN = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices';
const VOICE_WARMUP_TIMEOUT_MS = 8_000;

function warmVoiceAsset(voice) {
  if (!voice || typeof caches === 'undefined' || typeof fetch === 'undefined') return Promise.resolve(false);
  if (voiceWarmups.has(voice)) return voiceWarmups.get(voice);
  const task = (async () => {
    const cache = await caches.open('kokoro-voices');
    const remoteUrl = `${KOKORO_VOICE_ORIGIN}/${encodeURIComponent(voice)}.bin`;
    if (await cache.match(remoteUrl)) return true;
    const localUrl = new URL(`/api/kokoro/voice/${encodeURIComponent(voice)}`, self.location.origin);
    const response = await fetch(localUrl, { cache: 'force-cache' });
    if (!response.ok) return false;
    await cache.put(remoteUrl, response.clone());
    return true;
  })().catch(() => false);
  voiceWarmups.set(voice, task);
  return Promise.race([
    task,
    new Promise((resolve) => setTimeout(() => resolve(false), VOICE_WARMUP_TIMEOUT_MS)),
  ]);
}

function progress(detail) {
  self.postMessage({ type: 'progress', ...detail });
}

async function createModel(preferWebGpu) {
  const canUseWebGpu = preferWebGpu && Boolean(self.navigator?.gpu);
  const load = async (hasWebGpu) => {
    const options = kokoroModelOptions(hasWebGpu);
    progress({ status: 'loading', backend: options.device });
    const model = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
      ...options,
      progress_callback: (detail) => progress({ ...detail, backend: options.device }),
    });
    activeBackend = options.device;
    progress({ status: 'ready', backend: activeBackend });
    return model;
  };

  if (canUseWebGpu) {
    return load(true);
  }
  return load(false);
}

function getModel(preferWebGpu = true) {
  modelPromise ||= createModel(preferWebGpu).catch((error) => {
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

async function handle({ id, type, payload, preferWebGpu, generation }) {
  try {
    const model = await getModel(preferWebGpu);
    if (type === 'load') {
      self.postMessage({ id, type: 'loaded', backend: activeBackend, voices: Object.keys(model.voices) });
      return;
    }
    if (type !== 'synthesize') throw new Error(`Unknown speech worker request: ${type}`);
    if (generation !== activeGeneration) throw new Error('Narration request was superseded.');
    const voiceReady = await warmVoiceAsset(payload.voice);
    if (!voiceReady) progress({ status: 'voice-fallback', backend: activeBackend, voice: payload.voice });
    const audio = await model.generate(payload.text, { voice: payload.voice, speed: payload.speed });
    if (generation !== activeGeneration) throw new Error('Narration request was superseded.');
    const wav = audio.toWav();
    self.postMessage({ id, type: 'audio', audio: wav }, [wav]);
  } catch (error) {
    self.postMessage({ id, type: 'error', error: error?.message || 'Kokoro could not generate speech.' });
  }
}

async function drainQueue() {
  if (draining) return;
  draining = true;
  try {
    while (requestQueue.length) {
      requestQueue.sort((left, right) => (right.priority || 0) - (left.priority || 0));
      await handle(requestQueue.shift());
    }
  } finally {
    draining = false;
    if (requestQueue.length) drainQueue();
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { activeGeneration = data.generation; return; }
  requestQueue.push(data);
  drainQueue();
};
