import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/ort.webgpu.min.mjs';
import { F5Runtime } from './f5-runtime.mjs';
import { F5_MODEL } from './model-config.mjs';
import { NarrationQueue } from './narration-queue.mjs';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 1);
ort.env.webgpu.powerPreference = 'high-performance';
const runtime = new F5Runtime(ort, F5_MODEL);
const queue = new NarrationQueue(runtime);

self.onmessage = async ({ data }) => {
  if (data?.type === 'load') return runtime.load((stage) => self.postMessage({ type: 'progress', stage }));
  if (data?.type !== 'generate') return;
  try {
    queue.setVoice(data.voice);
    const wav = await queue.generate(data.text, data.targetSeconds);
    self.postMessage({ type: 'audio', requestId: data.requestId, wav }, [wav]);
  } catch (error) {
    self.postMessage({ type: 'error', requestId: data.requestId, message: error?.message || String(error) });
  }
};
