import assert from 'node:assert/strict';
import test from 'node:test';
import { NarrationQueue } from '../optimization/f5_tts/browser/narration-queue.mjs';

test('switches prompts without loading another model', async () => {
  const calls = [];
  const runtime = { generate: async (...args) => { calls.push(args); return args[1]; } };
  const queue = new NarrationQueue(runtime, 'male');
  assert.equal(await queue.generate('one', 4), 'male');
  queue.setVoice('female');
  assert.equal(await queue.generate('two', 4), 'female');
  assert.deepEqual(calls, [['one', 'male', 4, undefined], ['two', 'female', 4, undefined]]);
});

test('serializes inference jobs', async () => {
  let active = 0;
  let maximum = 0;
  const runtime = { generate: async () => { active += 1; maximum = Math.max(maximum, active); await new Promise((resolve) => setTimeout(resolve, 5)); active -= 1; } };
  const queue = new NarrationQueue(runtime);
  await Promise.all([queue.generate('one', 4), queue.generate('two', 4)]);
  assert.equal(maximum, 1);
});
