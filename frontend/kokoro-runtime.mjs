export const DEFAULT_KOKORO_URL = 'http://127.0.0.1:8766';

export function normalizeVoices(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((voice) => typeof voice === 'string').map((voice) => voice.trim()).filter(Boolean);
}

export function synthesisPayload({ text, voice, speed = 1, sentencePause = 0.25, expressiveness = 0.5 }) {
  return { text, voice, speed, sentence_pause: sentencePause, expressiveness };
}

export function audioCacheKey(index, voice, speed) {
  return `${index}:${voice}:${speed}`;
}
