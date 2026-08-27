const ranges = {
  speed: [0.6, 1.4],
  sentence_pause: [0, 0.8],
  expressiveness: [0, 1],
};

export async function readBoundedBody(request, maximumBytes) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maximumBytes) {
      await reader.cancel();
      throw new RangeError('Request is too large.');
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export function validateSynthesisRequest(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw new TypeError('Request must be valid JSON.'); }
  const text = typeof value?.text === 'string' ? value.text.trim() : '';
  const voice = typeof value?.voice === 'string' ? value.voice : '';
  if (!text || text.length > 12_000) throw new RangeError('Text must contain 1–12,000 characters.');
  if (!/^[a-z]{2}_[a-z0-9_]{1,60}$/i.test(voice)) throw new TypeError('Choose a valid Kokoro voice.');

  const payload = { text, voice };
  for (const [field, [minimum, maximum]] of Object.entries(ranges)) {
    const number = Number(value[field] ?? (field === 'speed' ? 1 : field === 'sentence_pause' ? 0.25 : 0.5));
    if (!Number.isFinite(number) || number < minimum || number > maximum) throw new RangeError(`${field} is outside the supported range.`);
    payload[field] = number;
  }
  return payload;
}
