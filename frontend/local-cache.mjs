const DATABASE = 'zuna-local-v1';
let databasePromise;

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function bookStorageKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function audioStorageKey({ bookKey, index, voice, speed, text }) {
  return `${bookKey}:${index}:${voice}:${speed}:${hashText(text)}`;
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  databasePromise ||= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('books');
      request.result.createObjectStore('audio');
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

export const getCachedBook = (key) => read('books', key);
export const cacheBook = (key, book) => write('books', key, book);
export const getCachedAudio = async (key) => (await read('audio', key))?.blob || null;
export const cacheAudio = (key, blob) => write('audio', key, { blob, createdAt: Date.now() });
