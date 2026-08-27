import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChapterMap, chapterGenerationOrder, cleanText, splitIntoPassages, clampProgress, textItemsToText } from '../reader-core.mjs';

test('separates front matter and named chapters into passage ranges', () => {
  const book = buildChapterMap(`Copyright 2026.\nCHAPTER ONE\nThe road begins here.\nChapter 2: A Door\nA second room waits.\nEPILOGUE\nThe journey ends.`);

  assert.deepEqual(book.chapters.map(({ title, startIndex, endIndex }) => ({ title, startIndex, endIndex })), [
    { title: 'Opening pages', startIndex: 0, endIndex: 0 },
    { title: 'CHAPTER ONE', startIndex: 1, endIndex: 1 },
    { title: 'Chapter 2: A Door', startIndex: 2, endIndex: 2 },
    { title: 'EPILOGUE', startIndex: 3, endIndex: 3 },
  ]);
  assert.equal(book.defaultChapterIndex, 1);
});

test('keeps books without headings available as one chapter', () => {
  const book = buildChapterMap('This book has one continuous section. It still needs narration.');

  assert.equal(book.chapters[0].title, 'Full book');
  assert.equal(book.passages.length, 2);
});

test('generates the selected chapter before the rest of the book', () => {
  const book = buildChapterMap(`Chapter 1\nOne. Two.\nChapter 2\nThree. Four.`);

  assert.deepEqual(chapterGenerationOrder(book.chapters, 1), [2, 3, 0, 1]);
});

test('preserves PDF line endings so chapter headings remain detectable', () => {
  assert.equal(textItemsToText([
    { str: 'CHAPTER ONE', hasEOL: true },
    { str: 'The first sentence.', hasEOL: false },
  ]), 'CHAPTER ONE\nThe first sentence.');
});

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
