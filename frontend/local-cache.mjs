const DATABASE = 'zuna-local-v1';
const DATABASE_VERSION = 3;
export const AUDIO_STORAGE_LIMIT_BYTES = 128 * 1024 * 1024;
let databasePromise;

export function selectAudioEvictions(entries, maxBytes = AUDIO_STORAGE_LIMIT_BYTES) {
  let total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.size) || 0), 0);
  const evictions = [];
  for (const entry of [...entries].sort((left, right) => (left.accessedAt || left.createdAt || 0) - (right.accessedAt || right.createdAt || 0))) {
    if (total <= maxBytes) break;
    total -= Math.max(0, Number(entry.size) || 0);
    evictions.push(entry.key);
  }
  return evictions;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function bookStorageKey(file) {
  return `book-v2:${file.name}:${file.size}:${file.lastModified}`;
}

export function audioStorageKey({ bookKey, index, voice, speed, text }) {
  return `${bookKey}:${index}:${voice}:${speed}:${hashText(text)}`;
}

export function sortCachedBooks(books) {
  return [...books].sort((left, right) => (right.savedAt || 0) - (left.savedAt || 0));
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('books')) database.createObjectStore('books');
      if (!database.objectStoreNames.contains('audio')) database.createObjectStore('audio');
      if (!database.objectStoreNames.contains('bookIndex')) {
        const bookIndex = database.createObjectStore('bookIndex');
        const cursor = request.transaction.objectStore('books').openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          bookIndex.put({ key: entry.key, name: entry.value?.name || 'Saved book', savedAt: entry.value?.savedAt || 0 }, entry.key);
          entry.continue();
        };
      }
      if (!database.objectStoreNames.contains('audioIndex')) {
        const audioIndex = database.createObjectStore('audioIndex');
        const cursor = request.transaction.objectStore('audio').openCursor();
        cursor.onsuccess = () => {
          const entry = cursor.result;
          if (!entry) return;
          const value = entry.value || {};
          audioIndex.put({
            key: entry.key,
            size: value.size || value.blob?.size || 0,
            createdAt: value.createdAt || 0,
            accessedAt: value.accessedAt || value.createdAt || 0,
          }, entry.key);
          entry.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return databasePromise;
}

async function read(store, key) {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function write(store, key, value) {
  try {
    const database = await openDatabase();
    await new Promise((resolve, reject) => {
      const request = database.transaction(store, 'readwrite').objectStore(store).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch {
    return false;
  }
}

async function writeBook(key, book) {
  try {
    const database = await openDatabase();
    const value = { ...book, savedAt: book.savedAt || Date.now() };
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['books', 'bookIndex'], 'readwrite');
      transaction.objectStore('books').put(value, key);
      transaction.objectStore('bookIndex').put({ key, name: value.name || 'Saved book', savedAt: value.savedAt }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  }
}

async function readAll(store) {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = database.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export const getCachedBook = (key) => read('books', key);
export const cacheBook = (key, book) => writeBook(key, book);
export const listCachedBooks = async () => sortCachedBooks(await readAll('bookIndex'));
export const getCachedAudio = async (key) => {
  const record = await read('audio', key);
  if (record?.blob) {
    const accessedAt = Date.now();
    write('audioIndex', key, { key, size: record.size || record.blob.size || 0, createdAt: record.createdAt || accessedAt, accessedAt });
    return record.blob;
  }
  return null;
};

let audioWriteQueue = Promise.resolve();
async function writeAndTrimAudio(key, blob) {
  try {
    const database = await openDatabase();
    const now = Date.now();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['audio', 'audioIndex'], 'readwrite');
      transaction.objectStore('audio').put({ blob, size: blob.size || 0, createdAt: now, accessedAt: now }, key);
      transaction.objectStore('audioIndex').put({ key, size: blob.size || 0, createdAt: now, accessedAt: now }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    const entries = await readAll('audioIndex');
    const evictions = selectAudioEvictions(entries);
    if (!evictions.length) return true;
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(['audio', 'audioIndex'], 'readwrite');
      evictions.forEach((evictionKey) => {
        transaction.objectStore('audio').delete(evictionKey);
        transaction.objectStore('audioIndex').delete(evictionKey);
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  }
}

export const cacheAudio = (key, blob) => {
  audioWriteQueue = audioWriteQueue.then(() => writeAndTrimAudio(key, blob));
  return audioWriteQueue;
};

export async function clearLocalCache() {
  try {
    if (databasePromise) (await databasePromise).close();
    databasePromise = undefined;
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DATABASE);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return true;
  } catch {
    return false;
  }
}
