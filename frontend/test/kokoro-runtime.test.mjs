import assert from 'node:assert/strict';
import test from 'node:test';
import { KOKORO_MODEL_ID, normalizeVoices, groupVoices, synthesisPayload, audioCacheKey, kokoroModelOptions, playbackPrefetchOrder, shouldPreferWebGpu, normalizeModelProgress, createAudioLru } from '../kokoro-runtime.mjs';

test('loads the official Kokoro ONNX model directly in the browser', () => {
  assert.equal(KOKORO_MODEL_ID, 'onnx-community/Kokoro-82M-v1.0-ONNX');
  assert.deepEqual(kokoroModelOptions(true), { device: 'webgpu', dtype: 'fp32' });
  assert.deepEqual(kokoroModelOptions(false), { device: 'wasm', dtype: 'q8' });
});

test('remembers a device that needs the reliable WASM fallback', () => {
  assert.equal(shouldPreferWebGpu(true, ''), true);
  assert.equal(shouldPreferWebGpu(true, 'webgpu'), true);
  assert.equal(shouldPreferWebGpu(true, 'wasm'), false);
  assert.equal(shouldPreferWebGpu(false, ''), false);
  assert.equal(shouldPreferWebGpu(true, '', 4), false);
  assert.equal(shouldPreferWebGpu(true, '', 8), true);
  assert.equal(shouldPreferWebGpu(true, '', undefined, 4, true), false);
});

test('normalizes model download progress for the loading bar', () => {
  assert.equal(normalizeModelProgress(41.6), 42);
  assert.equal(normalizeModelProgress(-4), 0);
  assert.equal(normalizeModelProgress(108), 100);
  assert.equal(normalizeModelProgress(undefined), null);
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

test('prefetches the next passages without crossing the end of the book', () => {
  assert.deepEqual(playbackPrefetchOrder(3, 8, 3), [4, 5, 6]);
  assert.deepEqual(playbackPrefetchOrder(6, 8, 3), [7]);
  assert.deepEqual(playbackPrefetchOrder(7, 8, 3), []);
});

test('evicts the oldest unpinned audio when the memory budget is exceeded', () => {
  const evicted = [];
  const cache = createAudioLru(10, (key, value) => evicted.push([key, value]));
  cache.set('first', 'url:first', 6);
  cache.set('second', 'url:second', 5);

  assert.equal(cache.get('first'), undefined);
  assert.equal(cache.get('second'), 'url:second');
  assert.deepEqual(evicted, [['first', 'url:first']]);
  assert.equal(cache.bytes, 5);
});

test('protects active audio until it is unpinned', () => {
  const evicted = [];
  const cache = createAudioLru(10, (key) => evicted.push(key));
  cache.set('playing', 'url:playing', 8);
  cache.pin('playing');
  cache.set('next', 'url:next', 8);

  assert.equal(cache.get('playing'), 'url:playing');
  assert.equal(cache.get('next'), undefined);
  assert.deepEqual(evicted, ['next']);

  cache.unpin('playing');
  assert.deepEqual(evicted, ['next']);
});
