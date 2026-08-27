import { unzipSync } from 'fflate';

const decoder = new TextDecoder();

function attributes(source) {
  return Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g), ([, key, value]) => [key, value]));
}

function directory(path) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index + 1);
}

function resolvePath(base, href) {
  const parts = `${base}${href.split('#')[0]}`.split('/');
  const resolved = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function unzipFiles(bytes, names, maxFileSize, maxTotalSize = maxFileSize) {
  let totalSize = 0;
  return unzipSync(bytes, { filter: (file) => {
    if (!names.has(file.name)) return false;
    totalSize += file.originalSize;
    if (file.originalSize > maxFileSize || totalSize > maxTotalSize) throw new RangeError('This EPUB exceeds the local extraction safety limit.');
    return true;
  } });
}

function decodeEntities(text) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1].toLowerCase() === 'x';
    return String.fromCodePoint(Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function readableText(html) {
  return decodeEntities(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/?(?:h[1-6]|p|div|li|blockquote|section|article|br)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export async function extractEpub(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const containerEntries = unzipFiles(bytes, new Set(['META-INF/container.xml']), 1_000_000);
  const container = decoder.decode(containerEntries['META-INF/container.xml'] || new Uint8Array());
  const rootPath = attributes(container.match(/<rootfile\b([^>]*)/i)?.[1] || '')['full-path'];
  if (!rootPath) throw new Error('This EPUB has no readable package file.');

  const packageEntry = unzipFiles(bytes, new Set([rootPath]), 5_000_000)[rootPath];
  if (!packageEntry) throw new Error('This EPUB has no readable package file.');
  const packageXml = decoder.decode(packageEntry);
  const base = directory(rootPath);
  const manifest = new Map(Array.from(packageXml.matchAll(/<item\b([^>]*)\/?\s*>/gi), ([, source]) => {
    const item = attributes(source);
    return [item.id, item.href];
  }).filter(([id, href]) => id && href));
  const spine = Array.from(packageXml.matchAll(/<itemref\b([^>]*)\/?\s*>/gi), ([, source]) => attributes(source).idref).filter(Boolean);
  const chapterPaths = spine.map((id) => manifest.get(id)).filter(Boolean).map((href) => resolvePath(base, href));
  const entries = unzipFiles(bytes, new Set(chapterPaths), 5_000_000, 64_000_000);
  const sections = chapterPaths.map((path) => entries[path]).filter(Boolean).map((entry) => readableText(decoder.decode(entry))).filter(Boolean);
  if (!sections.length) throw new Error('This EPUB has no readable chapters.');

  const rawTitle = packageXml.match(/<(?:\w+:)?title\b[^>]*>([\s\S]*?)<\/(?:\w+:)?title>/i)?.[1] || '';
  return { title: readableText(rawTitle), text: sections.join('\n') };
}
