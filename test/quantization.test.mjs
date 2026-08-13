import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TTS_MODEL_ID, TTS_OPTIONS } from '../tts-config.mjs';

test('uses the quantized Kokoro model in the WASM runtime', () => {
  assert.equal(TTS_MODEL_ID, 'onnx-community/Kokoro-82M-v1.0-ONNX');
  assert.deepEqual(TTS_OPTIONS, { dtype: 'q8', device: 'wasm' });
});

test('keeps F5 quantization behind the measured quality gate', async () => {
  const selected = JSON.parse(await readFile(new URL('../optimization/f5_tts/phases/05-quantization/selected.json', import.meta.url)));
  const quality = JSON.parse(await readFile(new URL('../optimization/f5_tts/phases/05-quantization/quality.json', import.meta.url)));
  assert.equal(selected.variant, 'fp16-nfe8');
  assert.ok(quality.summary.mean_wer > .9);
  assert.ok(quality.summary.mean_speaker_cosine_similarity < .5);
});
