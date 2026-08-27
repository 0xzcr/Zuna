export function splitIntoPassages(text) {
  return text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter((item) => item.length > 2) || [];
}

export function splitIntoNarrationChunks(text, { firstTarget = 280, target = 900, max = 1200 } = {}) {
  const sentences = splitIntoPassages(text);
  if (text.trim().length <= firstTarget) return sentences;

  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const limit = chunks.length ? target : firstTarget;
    if (current && current.length + sentence.length + 1 > limit) {
      chunks.push(current);
      current = '';
    }
    if (sentence.length <= max) {
      current = `${current} ${sentence}`.trim();
      continue;
    }
    for (const word of sentence.split(/\s+/)) {
      if (current && current.length + word.length + 1 > max) {
        chunks.push(current);
        current = '';
      }
      current = `${current} ${word}`.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const NUMBER_WORD = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)';
const CHAPTER_HEADING = new RegExp(`^(?:(?:chapter|part|book)\\s+(?:\\d+|[ivxlcdm]+|[a-z]|${NUMBER_WORD}(?:[ -]${NUMBER_WORD}){0,4})(?:\\s*(?:[:—–.-]\\s*|\\s+).+)?|appendix(?:\\s+[a-z0-9ivxlcdm]+)?(?:\\s*[:—–.-]\\s*.+)?|prologue|epilogue|preface|introduction|conclusion|afterword|acknowledg(?:e)?ments)(?:\\s*[:—–.-]\\s*.+)?$`, 'i');

function isChapterHeading(line) {
  const numberedHeading = /^\d{1,3}\s*[.:]\s+\S/.test(line) && line.length <= 80 && line.split(/\s+/).length <= 10;
  return (line.length <= 120 && CHAPTER_HEADING.test(line)) || numberedHeading;
}

function cleanLines(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const counts = new Map();
  lines.forEach((line) => counts.set(line, (counts.get(line) || 0) + 1));
  return lines.filter((line, index) => {
    if (/^\d{1,4}$/.test(line)) return false;
    const nextToPageNumber = /^\d{1,4}$/.test(lines[index - 1] || '') || /^\d{1,4}$/.test(lines[index + 1] || '');
    return (counts.get(line) || 0) < 2 || !nextToPageNumber || isChapterHeading(line);
  });
}

export function cleanText(text) {
  return cleanLines(text).join(' ');
}

export function buildChapterMap(text) {
  const sections = [{ title: 'Opening pages', lines: [] }];
  cleanLines(text).forEach((line) => {
    if (isChapterHeading(line)) sections.push({ title: line, lines: [] });
    else sections.at(-1).lines.push(line);
  });

  const namedChapters = sections.slice(1);
  const source = namedChapters.length ? sections : [{ title: 'Full book', lines: sections[0].lines }];
  const passages = [];
  const chapters = source.map(({ title, lines }) => {
    const chapterPassages = splitIntoNarrationChunks(lines.join(' '));
    const startIndex = passages.length;
    passages.push(...chapterPassages);
    return { title, startIndex, endIndex: passages.length - 1 };
  }).filter((chapter) => chapter.endIndex >= chapter.startIndex);

  return {
    chapters,
    passages,
    defaultChapterIndex: chapters[0]?.title === 'Opening pages' && chapters.length > 1 ? 1 : 0,
  };
}

export function chapterGenerationOrder(chapters, selectedChapterIndex = 0) {
  const selected = chapters[selectedChapterIndex] ? selectedChapterIndex : 0;
  const chapterOrder = chapters.map((_, offset) => (selected + offset) % chapters.length);
  return chapterOrder.flatMap((index) => {
    const chapter = chapters[index];
    return Array.from({ length: Math.max(0, chapter.endIndex - chapter.startIndex + 1) }, (_, offset) => chapter.startIndex + offset);
  });
}

export function chapterProgress(chapter, readyPassages) {
  const total = Math.max(0, chapter.endIndex - chapter.startIndex + 1);
  let ready = 0;
  for (let index = chapter.startIndex; index <= chapter.endIndex; index += 1) if (readyPassages.has(index)) ready += 1;
  return { ready, total, percent: total ? Math.round(ready / total * 100) : 0 };
}

export function textItemsToText(items) {
  let output = '';
  let previous;

  for (const item of items) {
    if (typeof item?.str !== 'string' || !item.str) continue;
    const x = item.transform?.[4];
    const y = item.transform?.[5];
    if (previous) {
      const previousX = previous.transform?.[4];
      const previousY = previous.transform?.[5];
      const height = Math.max(item.height || 0, previous.height || 0, 1);
      const positioned = [x, y, previousX, previousY].every(Number.isFinite);
      const newLine = previous.hasEOL || (positioned && Math.abs(y - previousY) > height * 0.65);
      const gap = positioned ? x - (previousX + (previous.width || 0)) : Infinity;

      if (newLine || (positioned && gap < -height * 2)) output += '\n';
      else if (gap > Math.max(1, height * 0.15) && !/\s$/.test(output) && !/^[,.;:!?)}\]]/.test(item.str)) output += ' ';
      else if (!positioned && !/\s$/.test(output)) output += ' ';
    }
    output += item.str;
    previous = item;
  }

  return output.replace(/\u00ad/g, '').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function dehyphenateLines(lines) {
  const output = [];
  for (const line of lines) {
    const previous = output.at(-1);
    if (previous && /\p{Ll}[\u00ad-]$/u.test(previous) && /^\p{Ll}/u.test(line)) {
      output[output.length - 1] = `${previous.slice(0, -1)}${line}`;
    } else {
      output.push(line);
    }
  }
  return output;
}

function marginKey(line) {
  return line.normalize('NFKC').toLocaleLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
}

export function normalizePdfPages(pages) {
  const pageLines = pages.map((page) => String(page || '').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean));
  const occurrences = new Map();

  pageLines.forEach((lines) => {
    const marginLines = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const key of new Set(marginLines.map(marginKey).filter(Boolean))) occurrences.set(key, (occurrences.get(key) || 0) + 1);
  });

  const repeatThreshold = pageLines.length >= 3 ? Math.max(2, Math.ceil(pageLines.length * 0.45)) : Infinity;
  const repeatedMargins = new Set([...occurrences].filter(([, count]) => count >= repeatThreshold).map(([key]) => key));

  return pageLines.map((lines) => {
    const content = lines.filter((line, index) => {
      const inMargin = index < 2 || index >= lines.length - 2;
      return !inMargin || (!/^[-–—]?\s*\d{1,5}\s*[-–—]?$/.test(line) && !repeatedMargins.has(marginKey(line)));
    });
    return dehyphenateLines(content).join('\n');
  }).filter(Boolean).join('\n\n');
}

export function decodePlainText(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let encoding = 'utf-8';
  let offset = 0;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'utf-16le'; offset = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = 'utf-16be'; offset = 2; }
  else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;

  const content = bytes.subarray(offset);
  if (encoding === 'utf-8') {
    const sample = content.subarray(0, Math.min(content.length, 4096));
    const evenZeros = sample.filter((byte, index) => index % 2 === 0 && byte === 0).length;
    const oddZeros = sample.filter((byte, index) => index % 2 === 1 && byte === 0).length;
    const zeroThreshold = Math.max(1, sample.length / 8);
    if (oddZeros > zeroThreshold) encoding = 'utf-16le';
    else if (evenZeros > zeroThreshold) encoding = 'utf-16be';
    else {
      try { return normalizeDecodedText(new TextDecoder('utf-8', { fatal: true }).decode(content)); }
      catch {
        const candidates = ['windows-1252', ...(content.length % 2 ? [] : ['utf-16le', 'utf-16be'])]
          .map((candidate) => normalizeDecodedText(new TextDecoder(candidate).decode(content)));
        return candidates.sort((left, right) => decodedTextScore(right) - decodedTextScore(left))[0];
      }
    }
  }
  return normalizeDecodedText(new TextDecoder(encoding).decode(content));
}

function normalizeDecodedText(text) {
  return text.replace(/\0/g, '').replace(/\r\n?|[\u2028\u2029]/g, '\n').normalize();
}

function decodedTextScore(text) {
  const characters = [...text];
  if (!characters.length) return 0;
  const letters = characters.filter((character) => /\p{L}/u.test(character)).length;
  const controls = characters.filter((character) => /[\u0000-\u0008\u000e-\u001f\ufffd]/u.test(character)).length;
  return letters / characters.length * 10 + letters - controls * 10;
}

export function hasReadableText(text) {
  return (String(text).match(/\p{L}/gu)?.length || 0) >= 6;
}

export function clampProgress(value, passageCount) {
  const max = Math.max(0, passageCount - 1);
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 0, 0), max);
}
