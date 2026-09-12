import assert from 'node:assert/strict';
import test from 'node:test';
import { isPhoneDevice } from '../device.mjs';

test('recognizes iPhone and mobile Android user agents', () => {
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X)' }), true);
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36' }), true);
});

test('does not block desktop browsers or tablets', () => {
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)' }), false);
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X)', maxTouchPoints: 5, width: 820 }), false);
});

test('recognizes a narrow touch-only device without relying on its user agent', () => {
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0', maxTouchPoints: 5, width: 390 }), true);
  assert.equal(isPhoneDevice({ userAgent: 'Mozilla/5.0', maxTouchPoints: 0, width: 390 }), false);
});
