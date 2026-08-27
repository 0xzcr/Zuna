const DATABASE = 'zuna-local-v1';
const DATABASE_VERSION = 2;
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
export const getCachedAudio = async (key) => (await read('audio', key))?.blob || null;
export const cacheAudio = (key, blob) => write('audio', key, { blob, createdAt: Date.now() });

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
