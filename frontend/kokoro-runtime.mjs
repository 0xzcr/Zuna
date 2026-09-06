export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export function normalizeModelProgress(progress) {
  return Number.isFinite(progress) ? Math.min(100, Math.max(0, Math.round(progress))) : null;
}

export function kokoroModelOptions(hasWebGpu) {
  return hasWebGpu ? { device: 'webgpu', dtype: 'fp32' } : { device: 'wasm', dtype: 'q8' };
}

export function shouldPreferWebGpu(hasWebGpu, savedBackend = '', deviceMemory = undefined, hardwareConcurrency = undefined, isMobile = false) {
  const lowMemoryDevice = Number.isFinite(deviceMemory) && deviceMemory <= 4;
  const constrainedMobile = Boolean(isMobile) && Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 6;
  const lowCpuUnknownMemory = !Number.isFinite(deviceMemory) && Number.isFinite(hardwareConcurrency) && hardwareConcurrency <= 2;
  return Boolean(hasWebGpu) && savedBackend === 'webgpu' && !lowMemoryDevice && !constrainedMobile && !lowCpuUnknownMemory;
}

export function estimateModelRemainingSeconds(progress, elapsedMs) {
  const value = Number(progress);
  if (!Number.isFinite(value) || value < 0) return null;
  if (value >= 100) return 0;
  if (value === 0 || !Number.isFinite(elapsedMs) || elapsedMs < 1000) return null;
  return Math.max(1, Math.ceil((elapsedMs * (100 - value)) / value / 1000));
}

const LANGUAGE_NAMES = { af: 'American English', am: 'American English', bf: 'British English', bm: 'British English', ef: 'Spanish', em: 'Spanish', ff: 'French', hf: 'Hindi', hm: 'Hindi', if: 'Italian', im: 'Italian', jf: 'Japanese', jm: 'Japanese', pf: 'Brazilian Portuguese', pm: 'Brazilian Portuguese', zf: 'Mandarin', zm: 'Mandarin' };

export function normalizeVoices(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((voice) => typeof voice === 'string').map((voice) => voice.trim()).filter(Boolean);
}

export function groupVoices(voices) {
  return normalizeVoices(voices).reduce((groups, voice) => {
    const label = LANGUAGE_NAMES[voice.slice(0, 2)] || 'Other Kokoro voices';
    const group = groups.find((item) => item.label === label);
    if (group) group.voices.push(voice);
    else groups.push({ label, voices: [voice] });
    return groups;
  }, []);
}

export function synthesisPayload({ text, voice, speed = 1, sentencePause = 0.25, expressiveness = 0.5 }) {
  return { text, voice, speed, sentence_pause: sentencePause, expressiveness };
}

export function audioCacheKey(index, voice, speed, text = '') {
  return `${index}:${voice}:${speed}${text ? `:${text}` : ''}`;
}

export function playbackPrefetchOrder(index, passageCount, lookahead = 3) {
  return Array.from({ length: Math.max(0, Math.min(lookahead, passageCount - index - 1)) }, (_, offset) => index + offset + 1);
}

export const AUDIO_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;

export function createAudioLru(maxBytes = AUDIO_MEMORY_LIMIT_BYTES, onEvict = () => {}) {
  const limit = Math.max(1, Number(maxBytes) || AUDIO_MEMORY_LIMIT_BYTES);
  const entries = new Map();
  let bytes = 0;

  function remove(key) {
    const entry = entries.get(key);
    if (!entry) return false;
    entries.delete(key); bytes -= entry.bytes; onEvict(key, entry.value); return true;
  }

  function trim() {
    while (bytes > limit) {
      const candidate = [...entries].find(([, entry]) => !entry.pinned);
      if (!candidate) break;
      remove(candidate[0]);
    }
  }

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key); entries.set(key, entry); return entry.value;
    },
    has: (key) => entries.has(key),
    set(key, value, size = 0) {
      remove(key); entries.set(key, { value, bytes: Math.max(0, Number(size) || 0), pinned: false }); bytes += Math.max(0, Number(size) || 0); trim(); return entries.has(key);
    },
    pin(key) { const entry = entries.get(key); if (entry) entry.pinned = true; return Boolean(entry); },
    unpin(key) { const entry = entries.get(key); if (entry) { entry.pinned = false; trim(); } return Boolean(entry); },
    delete: remove,
    clear() { [...entries.keys()].forEach(remove); },
    get size() { return entries.size; },
    get bytes() { return bytes; },
  };
}
