import assert from 'node:assert/strict';
import test from 'node:test';
import { processPagesInBatches } from '../progressive-pages.mjs';

test('publishes a large document incrementally in bounded batches', async () => {
  const batches = [];
  let reads = 0;
  await processPagesInBatches(20, async (page) => { reads += 1; return `page ${page}`; }, (pages) => {
    batches.push({ pages, reads });
  });
  assert.deepEqual(batches.map(({ pages }) => pages.length), [8, 8, 4]);
  assert.equal(batches[0].reads, 8);
});
