import assert from 'node:assert/strict';
import test from 'node:test';
import { createChunkQueue, advanceChunk } from '../src/reader-state.mjs';

test('creates a queue with the shared chunk state machine', () => {
  const queue = createChunkQueue(['One short chapter.', 'A second chapter.'], 'elias', 'kokoro');

  assert.deepEqual(queue.map((chunk) => chunk.state), ['queued', 'queued']);
  assert.equal(queue[0].voiceBackend, 'kokoro');
  assert.equal(queue[0].voiceId, 'elias');
});

test('advancing a chunk moves it through ready, playing, and played states', () => {
  let queue = createChunkQueue(['One short chapter.'], 'mira', 'kokoro');

  for (const state of ['ready', 'playing', 'played']) queue = advanceChunk(queue, 0, state);

  assert.equal(queue[0].state, 'played');
});

test('advancing an unknown chunk leaves the queue unchanged', () => {
  const queue = createChunkQueue(['One short chapter.'], 'elias', 'kokoro');

  assert.deepEqual(advanceChunk(queue, 4, 'ready'), queue);
});
