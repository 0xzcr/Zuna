import assert from 'node:assert/strict';
import test from 'node:test';
import { audioStorageKey, bookStorageKey, sortCachedBooks } from '../local-cache.mjs';

test('book cache keys distinguish changed files with the same name', () => {
  assert.notEqual(
    bookStorageKey({ name: 'novel.pdf', size: 1200, lastModified: 1 }),
    bookStorageKey({ name: 'novel.pdf', size: 1300, lastModified: 2 }),
  );
});

test('book cache keys carry the current extraction format version', () => {
  assert.match(bookStorageKey({ name: 'novel.pdf', size: 1200, lastModified: 1 }), /^book-v2:/);
});

test('saved books are ordered by most recently added', () => {
  assert.deepEqual(sortCachedBooks([
    { key: 'older', savedAt: 10 },
    { key: 'newer', savedAt: 30 },
    { key: 'middle', savedAt: 20 },
  ]).map((book) => book.key), ['newer', 'middle', 'older']);
});

test('audio cache keys distinguish text, voice, speed, and book', () => {
  const first = audioStorageKey({ bookKey: 'book-a', index: 0, voice: 'af_heart', speed: 1, text: 'One.' });
  assert.notEqual(first, audioStorageKey({ bookKey: 'book-b', index: 0, voice: 'af_heart', speed: 1, text: 'One.' }));
  assert.notEqual(first, audioStorageKey({ bookKey: 'book-a', index: 0, voice: 'am_adam', speed: 1, text: 'One.' }));
  assert.notEqual(first, audioStorageKey({ bookKey: 'book-a', index: 0, voice: 'af_heart', speed: 1.15, text: 'One.' }));
  assert.notEqual(first, audioStorageKey({ bookKey: 'book-a', index: 0, voice: 'af_heart', speed: 1, text: 'Two.' }));
});
