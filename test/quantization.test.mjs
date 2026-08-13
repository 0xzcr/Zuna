import assert from 'node:assert/strict';
import test from 'node:test';
import { TTS_MODEL_ID, TTS_OPTIONS } from '../tts-config.mjs';

test('uses the quantized Kokoro model in the WASM runtime', () => {
  assert.equal(TTS_MODEL_ID, 'onnx-community/Kokoro-82M-v1.0-ONNX');
  assert.deepEqual(TTS_OPTIONS, { dtype: 'q8', device: 'wasm' });
});
