export const KOKORO_BASE_URL = '/kokoro';

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
