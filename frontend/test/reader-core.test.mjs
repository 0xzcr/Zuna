import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanText, splitIntoPassages, clampProgress } from '../reader-core.mjs';

test('cleanText removes repeated headers and standalone page numbers', () => {
  const text = `ZUNA READER\n1\nThe first page has a real sentence.\nZUNA READER\n2\nThe second page has another real sentence.`;

  assert.equal(cleanText(text), 'The first page has a real sentence. The second page has another real sentence.');
});

test('splitIntoPassages groups readable sentences and ignores tiny fragments', () => {
  const passages = splitIntoPassages('A. This is a complete thought. Here is another one! x?');

  assert.deepEqual(passages, ['This is a complete thought.', 'Here is another one!']);
});

test('clampProgress keeps a saved position inside the available passage range', () => {
  assert.equal(clampProgress('9', 4), 3);
  assert.equal(clampProgress('-2', 4), 0);
  assert.equal(clampProgress('not-a-number', 0), 0);
});
