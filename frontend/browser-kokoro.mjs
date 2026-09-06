import { shouldPreferWebGpu } from './kokoro-runtime.mjs';

const WEBGPU_STALL_MS = 120_000;
const SYNTHESIS_TIMEOUT_MS = 120_000;
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

  request(type, payload = {}, priority = 0) {
    if (!this.worker) this.startWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { type, resolve, reject });
      this.worker.postMessage({ id, type, priority, ...payload });
    });
  }

  async load(onProgress) {
    if (onProgress) this.listeners.add(onProgress);
    if (!this.loadPromise) {
      const loadGeneration = this.generation;
      const loadPromise = this.loadFastestBackend(loadGeneration).catch((error) => {
        if (this.loadPromise === loadPromise) this.loadPromise = null;
        throw error;
      });
      this.loadPromise = loadPromise;
    }
    try { return await this.loadPromise; }
    finally { if (onProgress) this.listeners.delete(onProgress); }
  }

  async loadFastestBackend(loadGeneration = this.generation) {
    const isMobile = navigator.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    const preferWebGpu = shouldPreferWebGpu(Boolean(navigator.gpu), localStorage.getItem('zuna-kokoro-backend'), navigator.deviceMemory, navigator.hardwareConcurrency, isMobile);
    if (!preferWebGpu) {
      const result = await this.request('load', { preferWebGpu: false });
      localStorage.setItem('zuna-kokoro-backend', result.backend || 'wasm');
      return result;
    }
    try {
      const result = await this.loadWebGpuWithWatchdog(); localStorage.setItem('zuna-kokoro-backend', result.backend); return result;
    } catch (error) {
      if (this.generation !== loadGeneration) throw new DOMException('Kokoro was paused while this tab was inactive.', 'AbortError');
      if (error.code !== 'WEBGPU_STALL' && error.code !== 'WEBGPU_FAILED') throw error;
      localStorage.setItem('zuna-kokoro-backend', 'wasm'); this.listeners.forEach((listener) => listener({ type: 'progress', status: 'fallback', backend: 'wasm' }));
      this.stopWorker(error); this.startWorker(); return this.request('load', { preferWebGpu: false });
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
    return this.request('load', { preferWebGpu: true }).catch((error) => {
      const fallbackError = new Error(`WebGPU initialization failed: ${error.message}`);
      fallbackError.code = 'WEBGPU_FAILED';
      throw fallbackError;
    }).finally(() => { clearTimeout(timer); this.progressWatch = null; });
  }

  async synthesize(payload, { priority = 50 } = {}) {
    await this.load();
    let timer;
    const request = this.request('synthesize', { payload, generation: this.generation }, priority);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Kokoro audio generation timed out. Check the voice asset connection and try again.'); error.code = 'SYNTHESIS_TIMEOUT'; reject(error);
        this.restartWorker(error);
      }, SYNTHESIS_TIMEOUT_MS);
    });
    const result = await Promise.race([request, timeout]).finally(() => clearTimeout(timer));
    return new Blob([result.audio], { type: 'audio/wav' });
  }

  cancelSynthesis() {
    this.generation += 1;
    const error = new DOMException('Narration request was superseded.', 'AbortError');
    this.pending.forEach((request, id) => {
      if (request.type === 'synthesize') { request.reject(error); this.pending.delete(id); }
    });
    this.worker?.postMessage({ type: 'cancel', generation: this.generation });
  }

  restartWorker(error) {
    this.generation += 1;
    this.loadPromise = null;
    this.stopWorker(error);
    this.startWorker();
  }

  release() {
    this.generation += 1;
    this.loadPromise = null;
    if (this.worker) this.stopWorker(new DOMException('Kokoro was paused while this tab was inactive.', 'AbortError'));
  }
}

export function browserKokoro() {
  runtime ||= new BrowserKokoro();
  return runtime;
}
