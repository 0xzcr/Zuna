export function splitIntoPassages(text) {
  return text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter((item) => item.length > 2) || [];
}

export function cleanText(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const counts = new Map();
  lines.forEach((line) => counts.set(line, (counts.get(line) || 0) + 1));
  return lines.filter((line) => {
    if (/^\d{1,4}$/.test(line)) return false;
    if (line.length < 90 && (counts.get(line) || 0) > 1) return false;
    return true;
  }).join(' ');
}

export function clampProgress(value, passageCount) {
  const max = Math.max(0, passageCount - 1);
  const parsed = Number(value);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 0, 0), max);
}
