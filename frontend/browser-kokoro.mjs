import { shouldPreferWebGpu } from './kokoro-runtime.mjs';

const WEBGPU_STALL_MS = 120_000;
let runtime;

class BrowserKokoro {
  constructor() {
    this.pending = new Map(); this.listeners = new Set(); this.nextId = 1; this.generation = 0; this.loadPromise = null; this.progressWatch = null;
    this.startWorker();
  }

  startWorker() {
    const worker = new Worker(new URL('./kokoro-worker.mjs', import.meta.url), { type: 'module' }); this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      if (data.type === 'progress') {
        this.progressWatch?.();
        this.listeners.forEach((listener) => listener(data));
        return;
      }
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      if (data.type === 'error') request.reject(new Error(data.error));
      else request.resolve(data);
    };
    worker.onerror = (event) => {
      if (this.worker === worker) this.stopWorker(new Error(event.message || 'The browser speech worker stopped unexpectedly.'));
    };
    worker.postMessage({ type: 'cancel', generation: this.generation });
  }

  stopWorker(error) {
    const worker = this.worker; this.worker = null; worker?.terminate(); this.pending.forEach(({ reject }) => reject(error)); this.pending.clear(); this.progressWatch = null;
  }

  request(type, payload = {}) {
    if (!this.worker) this.startWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { type, resolve, reject });
      this.worker.postMessage({ id, type, ...payload });
    });
  }

  async load(onProgress) {
    if (onProgress) this.listeners.add(onProgress);
    if (!this.loadPromise) {
      this.loadPromise = this.loadFastestBackend().catch((error) => {
        this.loadPromise = null;
        throw error;
      });
    }
    try { return await this.loadPromise; }
    finally { if (onProgress) this.listeners.delete(onProgress); }
  }

  async loadFastestBackend() {
    const preferWebGpu = shouldPreferWebGpu(Boolean(navigator.gpu), localStorage.getItem('zuna-kokoro-backend'));
    if (!preferWebGpu) return this.request('load', { preferWebGpu: false });
    try {
      const result = await this.loadWebGpuWithWatchdog(); localStorage.setItem('zuna-kokoro-backend', result.backend); return result;
    } catch (error) {
      if (error.code !== 'WEBGPU_STALL') throw error;
      localStorage.setItem('zuna-kokoro-backend', 'wasm'); this.listeners.forEach((listener) => listener({ type: 'progress', status: 'fallback', backend: 'wasm' }));
      this.startWorker(); return this.request('load', { preferWebGpu: false });
    }
  }

  loadWebGpuWithWatchdog() {
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const error = new Error('WebGPU initialization stalled; using WASM.'); error.code = 'WEBGPU_STALL'; this.stopWorker(error);
      }, WEBGPU_STALL_MS);
    };
    this.progressWatch = arm; arm();
    return this.request('load', { preferWebGpu: true }).finally(() => { clearTimeout(timer); this.progressWatch = null; });
  }

  async synthesize(payload) {
    await this.load();
    const result = await this.request('synthesize', { payload, generation: this.generation });
    return new Blob([result.audio], { type: 'audio/wav' });
  }

  cancelSynthesis() {
    this.generation += 1;
    const error = new DOMException('Narration request was superseded.', 'AbortError');
    let wasGenerating = false;
    this.pending.forEach((request, id) => {
      if (request.type === 'synthesize') { wasGenerating = true; request.reject(error); this.pending.delete(id); }
    });
    if (wasGenerating) { this.stopWorker(error); this.loadPromise = null; this.startWorker(); }
    else this.worker?.postMessage({ type: 'cancel', generation: this.generation });
  }
}

export function browserKokoro() {
  runtime ||= new BrowserKokoro();
  return runtime;
}
