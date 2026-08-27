import assert from 'node:assert/strict';
import test from 'node:test';
import { KOKORO_BASE_URL, normalizeVoices, groupVoices, synthesisPayload, audioCacheKey } from '../kokoro-runtime.mjs';

test('routes Kokoro through the same-origin web server', () => {
  assert.equal(KOKORO_BASE_URL, '/kokoro');
});

test('normalizes the Kokoro voice list and keeps every valid voice', () => {
  assert.deepEqual(normalizeVoices(['af_heart', ' hi_sky ', '', 42, 'af_heart']), ['af_heart', 'hi_sky', 'af_heart']);
});

test('builds the local synthesis payload without provider or billing fields', () => {
  assert.deepEqual(synthesisPayload({ text: 'Hello.', voice: 'af_heart', speed: 1.15 }), {
    text: 'Hello.', voice: 'af_heart', speed: 1.15, sentence_pause: 0.25, expressiveness: 0.5,
  });
});

test('groups every voice into a stable language dropdown order', () => {
  assert.deepEqual(groupVoices(['hf_alpha', 'af_heart', 'hf_beta']), [
    { label: 'Hindi', voices: ['hf_alpha', 'hf_beta'] },
    { label: 'American English', voices: ['af_heart'] },
  ]);
});

test('separates cached audio by passage, voice, and speed', () => {
  assert.equal(audioCacheKey(3, 'af_heart', 1), '3:af_heart:1');
  assert.notEqual(audioCacheKey(3, 'af_heart', 1), audioCacheKey(3, 'am_adam', 1));
  assert.notEqual(audioCacheKey(3, 'af_heart', 1, 'First book.'), audioCacheKey(3, 'af_heart', 1, 'Second book.'));
});
