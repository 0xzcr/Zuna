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

const CHAPTER_HEADING = /^(?:(?:chapter|part|book)\s+(?:\d+|[ivxlcdm]+|[a-z]+)(?:\s*[:—–.-]\s*.+)?|prologue|epilogue|preface|introduction|afterword|acknowledg(?:e)?ments)$/i;

function isChapterHeading(line) {
  return line.length <= 120 && (CHAPTER_HEADING.test(line) || /^\d{1,3}\s*[.:]\s+\S/.test(line));
}

function cleanLines(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const counts = new Map();
  lines.forEach((line) => counts.set(line, (counts.get(line) || 0) + 1));
  return lines.filter((line) => !/^\d{1,4}$/.test(line) && (isChapterHeading(line) || line.length >= 90 || (counts.get(line) || 0) === 1));
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

export function textItemsToText(items) {
  return items.map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`).join('').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

export function clampProgress(value, passageCount) {
  const max = Math.max(0, passageCount - 1);
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 0, 0), max);
}
