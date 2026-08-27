import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildChapterMap,
  chapterGenerationOrder,
  cleanText,
  decodePlainText,
  hasReadableText,
  normalizePdfPages,
  splitIntoPassages,
  splitIntoNarrationChunks,
  clampProgress,
  textItemsToText,
} from '../reader-core.mjs';

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

test('prepares following chapters before earlier front matter', () => {
  const book = buildChapterMap(`Copyright page.\nChapter 1\nOne. Two.\nChapter 2\nThree. Four.`);

  assert.deepEqual(chapterGenerationOrder(book.chapters, 1), [1, 2, 3, 4, 0]);
});

test('preserves PDF line endings so chapter headings remain detectable', () => {
  assert.equal(textItemsToText([
    { str: 'CHAPTER ONE', hasEOL: true },
    { str: 'The first sentence.', hasEOL: false },
  ]), 'CHAPTER ONE\nThe first sentence.');
});

test('reconstructs PDF words from positioned fragments without inventing spaces', () => {
  assert.equal(textItemsToText([
    { str: 'Hel', transform: [1, 0, 0, 10, 10, 700], width: 15, height: 10 },
    { str: 'lo', transform: [1, 0, 0, 10, 25, 700], width: 10, height: 10 },
    { str: 'world', transform: [1, 0, 0, 10, 42, 700], width: 25, height: 10, hasEOL: true },
    { str: 'Again.', transform: [1, 0, 0, 10, 10, 680], width: 30, height: 10 },
  ]), 'Hello world\nAgain.');
});

test('normalizes PDF page-wrap hyphenation and repeated margin furniture', () => {
  const text = normalizePdfPages([
    'THE SAMPLE BOOK\n1\nCHAPTER ONE\nAn extraor-\ndinary morning began.\nPRIVATE EDITION',
    'THE SAMPLE BOOK\n2\nThe story continues here.\nPRIVATE EDITION',
    'THE SAMPLE BOOK\n3\nThe story ends here.\nPRIVATE EDITION',
  ]);

  assert.equal(text, 'CHAPTER ONE\nAn extraordinary morning began.\n\nThe story continues here.\n\nThe story ends here.');
});

test('preserves repeated body prose while cleaning a document', () => {
  assert.equal(cleanText('Chapter 1\nNever again.\nNever again.\nThen silence.'), 'Chapter 1 Never again. Never again. Then silence.');
});

test('detects common untitled and titled chapter headings', () => {
  const book = buildChapterMap('CHAPTER TWENTY THREE The Long Road\nIt begins.\nAppendix A\nReference material.');

  assert.deepEqual(book.chapters.map((chapter) => chapter.title), ['CHAPTER TWENTY THREE The Long Road', 'Appendix A']);
});

test('does not mistake long numbered list items for chapters', () => {
  const book = buildChapterMap('1. INTRODUCTION\nThe lesson begins.\n1. Hardware: Hardware includes all physical devices in the network. These devices help\npeople communicate properly.');

  assert.deepEqual(book.chapters.map((chapter) => chapter.title), ['1. INTRODUCTION']);
});

test('decodes UTF-16 and Windows-1252 plain-text books', () => {
  const utf16 = new Uint8Array([0xff, 0xfe, 0x43, 0x00, 0x61, 0x00, 0x66, 0x00, 0xe9, 0x00]);
  const utf16WithoutBom = new Uint8Array([0x43, 0x00, 0x61, 0x00, 0x66, 0x00, 0xe9, 0x00]);
  const utf16CjkWithoutBom = new Uint8Array([0x2c, 0x7b, 0x00, 0x4e, 0xe0, 0x7a]);
  const windows1252 = new Uint8Array([0x43, 0x61, 0x66, 0xe9]);

  assert.equal(decodePlainText(utf16), 'Café');
  assert.equal(decodePlainText(utf16WithoutBom), 'Café');
  assert.equal(decodePlainText(utf16CjkWithoutBom), '第一章');
  assert.equal(decodePlainText(windows1252), 'Café');
});

test('recognizes readable text across scripts and rejects page-number noise', () => {
  assert.equal(hasReadableText('1\n2\n3'), false);
  assert.equal(hasReadableText('第一章 今天是个好日子。'), true);
});

test('cleanText removes repeated headers and standalone page numbers', () => {
  const text = `ZUNA READER\n1\nThe first page has a real sentence.\nZUNA READER\n2\nThe second page has another real sentence.`;

  assert.equal(cleanText(text), 'The first page has a real sentence. The second page has another real sentence.');
});

test('splitIntoPassages groups readable sentences and ignores tiny fragments', () => {
  const passages = splitIntoPassages('A. This is a complete thought. Here is another one! x?');

  assert.deepEqual(passages, ['This is a complete thought.', 'Here is another one!']);
});

test('narration chunks start quickly and batch later sentences without losing text', () => {
  const text = Array.from({ length: 24 }, (_, index) => `Sentence ${index + 1} carries enough words to sound natural.`).join(' ');
  const chunks = splitIntoNarrationChunks(text, { firstTarget: 180, target: 420, max: 520 });

  assert.ok(chunks.length < splitIntoPassages(text).length);
  assert.ok(chunks[0].length <= 220);
  assert.ok(chunks.slice(1).every((chunk) => chunk.length <= 520));
  assert.equal(chunks.join(' '), text);
});

test('chapter maps use bounded narration chunks instead of one request per sentence', () => {
  const chapter = Array.from({ length: 30 }, (_, index) => `This is sentence number ${index + 1} in the chapter.`).join(' ');
  const book = buildChapterMap(`Chapter 1\n${chapter}`);

  assert.ok(book.passages.length < 10);
  assert.equal(book.passages.join(' '), chapter);
});

test('clampProgress keeps a saved position inside the available passage range', () => {
  assert.equal(clampProgress('9', 4), 3);
  assert.equal(clampProgress('-2', 4), 0);
  assert.equal(clampProgress('not-a-number', 0), 0);
});
