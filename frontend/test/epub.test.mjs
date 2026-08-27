import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { extractEpub } from '../epub.mjs';

test('extracts EPUB chapters in spine order with readable headings', async () => {
  const archive = zipSync({
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>'),
    'OEBPS/book.opf': strToU8('<?xml version="1.0"?><package><metadata><dc:title>Small Book</dc:title></metadata><manifest><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>'),
    'OEBPS/one.xhtml': strToU8('<html><body><h1>Chapter One</h1><p>The first room opens.</p></body></html>'),
    'OEBPS/two.xhtml': strToU8('<html><body><h1>Chapter Two</h1><p>The second room follows.</p></body></html>'),
  });

  const book = await extractEpub(archive.buffer);

  assert.equal(book.title, 'Small Book');
  assert.match(book.text, /Chapter One\nThe first room opens\./);
  assert.ok(book.text.indexOf('Chapter One') < book.text.indexOf('Chapter Two'));
});
