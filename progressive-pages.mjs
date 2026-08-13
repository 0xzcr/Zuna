export async function processPagesInBatches(pageCount, readPage, onBatch, batchSize = 8) {
  for (let start = 1; start <= pageCount; start += batchSize) {
    const end = Math.min(pageCount, start + batchSize - 1);
    const pages = await Promise.all(Array.from({ length: end - start + 1 }, (_, index) => readPage(start + index)));
    if (await onBatch(pages, end, pageCount) === false) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
