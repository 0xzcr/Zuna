import { KokoroTTS } from 'kokoro-js';
import { KOKORO_MODEL_ID, kokoroModelOptions } from './kokoro-runtime.mjs';

let modelPromise;
let activeBackend = '';
let activeGeneration = 0;
let queue = Promise.resolve();

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
    try { return await load(true); }
    catch (error) {
      console.warn('Kokoro WebGPU initialization failed; using WASM.', error);
      progress({ status: 'fallback', backend: 'wasm' });
    }
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
    const audio = await model.generate(payload.text, { voice: payload.voice, speed: payload.speed });
    const wav = audio.toWav();
    self.postMessage({ id, type: 'audio', audio: wav }, [wav]);
  } catch (error) {
    self.postMessage({ id, type: 'error', error: error?.message || 'Kokoro could not generate speech.' });
  }
}

self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { activeGeneration = data.generation; return; }
  queue = queue.then(() => handle(data));
};
