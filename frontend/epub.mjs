import { unzipSync } from 'fflate';

const decoder = new TextDecoder();

function attributes(source) {
  return Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g), ([, key, value]) => [key, value]));
}

function directory(path) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index + 1);
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
  const entries = unzipSync(bytes);
  const container = decoder.decode(entries['META-INF/container.xml'] || new Uint8Array());
  const rootPath = attributes(container.match(/<rootfile\b([^>]*)/i)?.[1] || '')['full-path'];
  if (!rootPath || !entries[rootPath]) throw new Error('This EPUB has no readable package file.');

  const packageXml = decoder.decode(entries[rootPath]);
  const base = directory(rootPath);
  const manifest = new Map(Array.from(packageXml.matchAll(/<item\b([^>]*)\/?\s*>/gi), ([, source]) => {
    const item = attributes(source);
    return [item.id, item.href];
  }).filter(([id, href]) => id && href));
  const spine = Array.from(packageXml.matchAll(/<itemref\b([^>]*)\/?\s*>/gi), ([, source]) => attributes(source).idref).filter(Boolean);
  const sections = spine.map((id) => entries[`${base}${manifest.get(id)}`]).filter(Boolean).map((entry) => readableText(decoder.decode(entry))).filter(Boolean);
  if (!sections.length) throw new Error('This EPUB has no readable chapters.');

  const rawTitle = packageXml.match(/<(?:\w+:)?title\b[^>]*>([\s\S]*?)<\/(?:\w+:)?title>/i)?.[1] || '';
  return { title: readableText(rawTitle), text: sections.join('\n') };
}
