import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const browserFiles = ['frontend/app.js', 'frontend/reader-core.mjs', 'frontend/epub.mjs'];

test('browser entrypoints avoid APIs missing on older mobile WebKit', () => {
  const unsupportedApi = /\.at\(|\.flatMap\(|\.replaceAll\(|\.matchAll\(|Object\.fromEntries/;
  browserFiles.forEach((file) => assert.doesNotMatch(fs.readFileSync(file, 'utf8'), unsupportedApi, file));
});

test('PDF extraction uses the compatibility worker entrypoint', () => {
  assert.match(fs.readFileSync('frontend/app.js', 'utf8'), /pdf\.worker\.compat\.mjs/);
  const shim = fs.readFileSync('public/pdf.worker.compat.mjs', 'utf8');
  ['Promise.withResolvers', 'URL.parse', 'Uint8Array.fromBase64', 'Map.prototype.getOrInsertComputed'].forEach((api) => {
    assert.match(shim, new RegExp(api.replace('.', '\\.'), 'u'), api);
  });
});
