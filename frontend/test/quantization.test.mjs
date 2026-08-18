import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TTS_MODEL, TTS_OPTIONS } from '../tts-config.mjs';

test('uses the validated F5 model in the browser runtime', () => {
  assert.equal(TTS_MODEL.baseUrl, '/backend/models/f5/fp16-nfe8');
  assert.equal(TTS_MODEL.nfeSteps, 8);
  assert.equal(TTS_MODEL.assetVersion, '20260813-f5-v2');
  assert.equal(TTS_MODEL.transformerParts.length, 8);
  assert.deepEqual(TTS_OPTIONS, { runtime: 'onnxruntime-web', nfeSteps: 8, output: 'pcm16-wav' });
});

test('keeps F5 quantization behind the measured quality gate', async () => {
  const selected = JSON.parse(await readFile(new URL('../../backend/optimization/f5_tts/phases/05-quantization/selected.json', import.meta.url)));
  const quality = JSON.parse(await readFile(new URL('../../backend/optimization/f5_tts/phases/05-quantization/quality.json', import.meta.url)));
  assert.equal(selected.variant, 'fp16-nfe8');
  assert.ok(quality.summary.mean_wer > .9);
  assert.ok(quality.summary.mean_speaker_cosine_similarity < .5);
});
