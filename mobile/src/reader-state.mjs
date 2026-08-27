export const CHUNK_STATES = ['queued', 'generating', 'ready', 'playing', 'played'];

export function createChunkQueue(passages, voiceId, voiceBackend) {
  return passages.map((text, orderIndex) => ({
    id: `chunk-${orderIndex + 1}`,
    orderIndex,
    text,
    state: 'queued',
    voiceId,
    voiceBackend,
    audioPath: null,
  }));
}

export function advanceChunk(queue, index, nextState) {
  if (!CHUNK_STATES.includes(nextState) || !queue[index]) return queue;
  return queue.map((chunk, chunkIndex) => chunkIndex === index ? { ...chunk, state: nextState } : chunk);
}
