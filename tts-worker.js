import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.webgpu.min.mjs';
import { F5Runtime } from './optimization/f5_tts/browser/f5-runtime.mjs';
import { F5_MODEL } from './optimization/f5_tts/browser/model-config.mjs';
import { NarrationQueue } from './optimization/f5_tts/browser/narration-queue.mjs';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
ort.env.webgpu.powerPreference = 'high-performance';

const runtime = new F5Runtime(ort, F5_MODEL);
const queue = new NarrationQueue(runtime);

async function load() {
  await runtime.load((stage, step, total) => self.postMessage({ type: 'progress', stage, step, total }));
  self.postMessage({ type: 'ready', provider: runtime.transformerProvider });
}

async function generate(request) {
  queue.setVoice(request.voice);
  const wav = await queue.generate(
    request.text,
    request.targetSeconds,
    (stage, step, total) => self.postMessage({ type: 'progress', requestId: request.requestId, stage, step, total }),
  );
  self.postMessage({ type: 'audio', requestId: request.requestId, prefetch: request.prefetch === true, wav }, [wav]);
}

self.onmessage = ({ data }) => {
  if (data?.type === 'cancel') {
    queue.cancel();
    return;
  }
  if (data?.type === 'load') {
    load().catch((error) => self.postMessage({ type: 'error', message: error?.message || String(error) }));
    return;
  }
  if (data?.type !== 'speak') return;
  generate(data).catch((error) => self.postMessage({ type: 'error', requestId: data.requestId, prefetch: data.prefetch === true, message: error?.message || String(error) }));
};
