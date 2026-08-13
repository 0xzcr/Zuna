import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CEILING, peakNormalize } from '../optimization/f5_tts/browser/audio-postprocess.mjs';

test('leaves already-safe audio untouched', () => {
  const input = new Float32Array([-.5, 0, .5]);
  const result = peakNormalize(input);
  assert.equal(result.samples, input);
  assert.equal(result.gain, 1);
});

test('linearly attenuates hot audio to -1 dBFS', () => {
  const result = peakNormalize(new Float32Array([-2, 1]));
  assert.ok(Math.abs(result.samples[0] + DEFAULT_CEILING) < 1e-6);
  assert.ok(Math.abs(result.samples[1] - DEFAULT_CEILING / 2) < 1e-6);
  assert.equal(result.samples[0] / result.samples[1], -2);
});
