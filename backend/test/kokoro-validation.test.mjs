import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedBody, validateSynthesisRequest } from '../../app/api/kokoro/validation.mjs';

test('accepts a bounded local Kokoro synthesis request', () => {
  const payload = validateSynthesisRequest(JSON.stringify({ text: 'Hello.', voice: 'af_heart', speed: 1 }));
  assert.equal(payload.text, 'Hello.');
});

test('rejects malformed, oversized, and out-of-range synthesis requests', () => {
  assert.throws(() => validateSynthesisRequest('{'), /valid JSON/);
  assert.throws(() => validateSynthesisRequest(JSON.stringify({ text: 'x'.repeat(12_001), voice: 'af_heart', speed: 1 })), /1–12,000/);
  assert.throws(() => validateSynthesisRequest(JSON.stringify({ text: 'Hello.', voice: 'not a voice', speed: 1 })), /voice/);
  assert.throws(() => validateSynthesisRequest(JSON.stringify({ text: 'Hello.', voice: 'af_heart', speed: 9 })), /speed/);
});

test('stops reading a streamed request once it crosses the byte limit', async () => {
  const request = new Request('http://localhost/synthesize', { method: 'POST', body: 'x'.repeat(65_000) });
  await assert.rejects(readBoundedBody(request, 64_000), /too large/);
});
