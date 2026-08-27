import { processPagesInBatches } from './progressive-pages.mjs';
import { buildChapterMap, chapterGenerationOrder, clampProgress, textItemsToText } from './reader-core.mjs?v=8';
import { KOKORO_BASE_URL, normalizeVoices, groupVoices, synthesisPayload } from './kokoro-runtime.mjs?v=7';
import { audioStorageKey, bookStorageKey, cacheAudio, cacheBook, clearLocalCache, getCachedAudio, getCachedBook } from './local-cache.mjs';

const state = {
  chapters: [], passages: [], index: 0, chapterIndex: 0, sourceText: '', documentComplete: false, generationStatus: 'Import a book to prepare its chapters.',
  voice: localStorage.getItem('zuna-kokoro-voice') || '',
  speed: Number(localStorage.getItem('zuna-speed') || 1), fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false, theme: localStorage.getItem('zuna-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  kokoroVoices: [], kokoroOnline: false, bookKey: '',
};

const $ = (selector) => document.querySelector(selector);
const pdfInput = $('#pdfInput'); const dropZone = $('#dropZone'); const libraryPanel = $('#libraryPanel');
const passage = $('#passage'); const seek = $('#seek'); const playButton = $('#playButton'); const toast = $('#toast'); const engineNote = $('#engineNote');
const audioCache = new Map(); const audioJobs = new Map(); let activeAudio = null; let playbackRun = 0; let generationRun = 0; let extractionId = 0;

function applyTheme(theme) {
  state.theme = theme; document.documentElement.dataset.theme = theme; localStorage.setItem('zuna-theme', theme);
  const toggle = $('#themeToggle'); if (toggle) { toggle.setAttribute('aria-pressed', String(theme === 'dark')); toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`); }
  const icon = $('#themeIcon'); if (icon) icon.textContent = theme === 'dark' ? '☾' : '☼';
}

applyTheme(state.theme); $('#themeToggle')?.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

function notify(message) { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 3400); }
function setEngineNote(message) { engineNote.textContent = message; }
function languageName(voice) { return ({ af: 'American English', am: 'American English', bf: 'British English', bm: 'British English', ef: 'Spanish', em: 'Spanish', ff: 'French', hf: 'Hindi', hm: 'Hindi', if: 'Italian', im: 'Italian', jf: 'Japanese', jm: 'Japanese', pf: 'Brazilian Portuguese', pm: 'Brazilian Portuguese', zf: 'Mandarin', zm: 'Mandarin' })[voice.slice(0, 2)] || 'Kokoro voice'; }
function voiceDisplayName(voice) { return voice.slice(3).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || voice; }

function renderVoicePicker() {
  const select = $('#voiceSelect'); if (!select) return;
  const picker = document.querySelector('.voice-picker');
  let retry = $('#retryKokoro');
  if (!retry && picker) { retry = document.createElement('button'); retry.id = 'retryKokoro'; retry.className = 'retry-button'; retry.type = 'button'; retry.textContent = 'Retry connection'; retry.addEventListener('click', loadKokoroVoices); picker.append(retry); }
  if (retry) retry.hidden = state.kokoroOnline;
  select.replaceChildren();
  if (!state.kokoroVoices.length) {
    const option = document.createElement('option'); option.textContent = 'Start the local Kokoro runtime…'; select.append(option); select.disabled = true;
    const count = $('#voiceCount'); if (count) count.textContent = 'Runtime offline'; return;
  }
  groupVoices(state.kokoroVoices).forEach(({ label, voices }) => {
    const group = document.createElement('optgroup'); group.label = label;
    voices.forEach((voice) => { const option = document.createElement('option'); option.value = voice; option.textContent = voiceDisplayName(voice); group.append(option); });
    select.append(group);
  });
  select.disabled = false; select.value = state.voice; const count = $('#voiceCount'); if (count) count.textContent = `${state.kokoroVoices.length} voices · all free`;
}

function chooseVoice(voice) {
  const wasSpeaking = state.speaking; stopAudio(); clearAudioCache(); state.voice = voice; localStorage.setItem('zuna-kokoro-voice', voice); renderVoicePicker(); startBackgroundGeneration();
  if (wasSpeaking) speakCurrent();
}

async function loadKokoroVoices() {
  try {
    const response = await fetch(`${KOKORO_BASE_URL}/voices`, { cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error('Voice endpoint unavailable');
    state.kokoroVoices = normalizeVoices(await response.json()); state.kokoroOnline = state.kokoroVoices.length > 0;
    if (!state.kokoroVoices.includes(state.voice)) { state.voice = state.kokoroVoices[0] || ''; if (state.voice) localStorage.setItem('zuna-kokoro-voice', state.voice); }
    setEngineNote(state.kokoroOnline ? `Kokoro local runtime · ${state.kokoroVoices.length} voices · all free` : 'Kokoro runtime is online but has no voice pack.');
  } catch { state.kokoroVoices = []; state.kokoroOnline = false; setEngineNote('Kokoro is offline · see backend/README.md to start the local runtime'); }
  renderVoicePicker(); if (state.kokoroOnline && state.documentComplete) startBackgroundGeneration();
}

function chapterForPassage(index) { return Math.max(0, state.chapters.findIndex((chapter) => index >= chapter.startIndex && index <= chapter.endIndex)); }
function setChapterStatus(message) { state.generationStatus = message; const status = $('#chapterStatus'); if (status) status.textContent = message; }
function renderChapterPicker() {
  const select = $('#chapterSelect'); if (!select) return; select.replaceChildren();
  if (!state.chapters.length) { const option = document.createElement('option'); option.textContent = 'Choose a book first…'; select.append(option); select.disabled = true; setChapterStatus(state.generationStatus); return; }
  state.chapters.forEach((chapter, index) => { const option = document.createElement('option'); option.value = String(index); option.textContent = chapter.title; select.append(option); });
  select.disabled = false; select.value = String(state.chapterIndex); setChapterStatus(state.generationStatus);
}

function applyChapterMap(preservePosition = false) {
  const currentPassage = preservePosition ? state.passages[state.index] : null; const book = buildChapterMap(state.sourceText); state.chapters = book.chapters; state.passages = book.passages;
  const savedIndex = localStorage.getItem(`zuna-progress:${state.fileName}`); const firstChapterIndex = state.chapters[book.defaultChapterIndex]?.startIndex || 0; const preservedIndex = currentPassage ? state.passages.indexOf(currentPassage) : -1;
  state.index = preservedIndex >= 0 ? preservedIndex : clampProgress(preservePosition ? state.index : savedIndex ?? firstChapterIndex, state.passages.length);
  state.chapterIndex = state.passages.length ? chapterForPassage(state.index) : book.defaultChapterIndex; seek.max = Math.max(0, state.passages.length - 1); renderChapterPicker(); renderPassage();
}

function setDocument(text, name, complete = true, bookKey = state.bookKey) {
  stopAudio(); clearAudioCache(); generationRun += 1; state.sourceText = text; state.documentComplete = complete; state.fileName = name; state.bookKey = bookKey; state.generationStatus = complete ? 'Narration queued in the background.' : 'Finding chapters as pages load…'; applyChapterMap();
  localStorage.setItem('zuna-file-name', name); $('#fileName').textContent = name; $('#fileMeta').textContent = `${state.chapters.length} chapters · ${state.passages.length} passages · local only`; libraryPanel.hidden = false;
  document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); notify(`${state.chapters.length || 1} chapters ready to choose.`); if (complete) startBackgroundGeneration(); else warmCurrentPassage();
}

function appendDocument(text, page, pageCount) { state.sourceText += `\n${text}`; state.documentComplete = page === pageCount; state.generationStatus = state.documentComplete ? 'Narration queued in the background.' : 'Finding chapters as pages load…'; applyChapterMap(true); $('#fileMeta').textContent = `${state.chapters.length} chapters · ${state.passages.length} passages · reading page ${page} / ${pageCount}`; if (state.documentComplete) startBackgroundGeneration(); }
function renderPassage() { const current = state.passages[state.index]; state.chapterIndex = current ? chapterForPassage(state.index) : state.chapterIndex; const chapter = state.chapters[state.chapterIndex]; $('#chapterSelect').value = String(state.chapterIndex); $('#nowPlayingLabel').textContent = state.fileName ? `${state.fileName} · ${chapter?.title || 'Full book'}` : 'Choose a document to begin'; $('#progressLabel').textContent = state.passages.length ? `${state.index + 1} / ${state.passages.length}` : '0 / 0'; seek.value = state.index; if (!current) { passage.innerHTML = '<span class="passage-placeholder">Your current passage will appear here.</span>'; return; } passage.textContent = current; localStorage.setItem(`zuna-progress:${state.fileName}`, String(state.index)); }

function setPlayState(playing) { state.speaking = playing; playButton.textContent = playing ? 'Ⅱ' : '▶'; playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play'); playButton.setAttribute('aria-pressed', String(playing)); }
function clearAudioCache() { generationRun += 1; audioCache.forEach((url) => URL.revokeObjectURL(url)); audioCache.clear(); }
function stopAudio() { playbackRun += 1; if (activeAudio) { activeAudio.pause(); activeAudio.removeAttribute('src'); activeAudio = null; } setPlayState(false); }

async function generateAudio(index) {
  if (!state.kokoroOnline || !state.voice) throw new Error('Start the local Kokoro runtime and choose a voice first.');
  const text = state.passages[index];
  const key = audioStorageKey({ bookKey: state.bookKey || state.fileName, index, voice: state.voice, speed: state.speed, text });
  if (audioCache.has(key)) return audioCache.get(key);
  if (audioJobs.has(key)) return audioJobs.get(key);
  const job = (async () => { const stored = await getCachedAudio(key); if (stored) { const storedUrl = URL.createObjectURL(stored); audioCache.set(key, storedUrl); return storedUrl; }
    const response = await fetch(`${KOKORO_BASE_URL}/synthesize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(synthesisPayload({ text, voice: state.voice, speed: state.speed })) });
    if (!response.ok) { let message = 'Kokoro could not generate this passage.'; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
    const blob = await response.blob(); cacheAudio(key, blob); const url = URL.createObjectURL(blob); audioCache.set(key, url); return url; })();
  audioJobs.set(key, job); try { return await job; } finally { audioJobs.delete(key); }
}

function warmCurrentPassage() {
  if (state.kokoroOnline && state.voice && state.passages[state.index]) generateAudio(state.index).catch(() => {});
}

async function startBackgroundGeneration() {
  const run = ++generationRun; if (!state.documentComplete) return; if (!state.passages.length) { setChapterStatus('No readable chapter text was found.'); return; }
  if (!state.kokoroOnline || !state.voice) { setChapterStatus('Generation will begin when Kokoro is online.'); return; }
  const order = chapterGenerationOrder(state.chapters, state.chapterIndex); let ready = 0;
  for (const index of order) { if (run !== generationRun) return; const chapter = state.chapters[chapterForPassage(index)]; setChapterStatus(`Preparing ${chapter.title} · ${ready} / ${order.length} passages`);
    try { await generateAudio(index); } catch { if (run === generationRun) setChapterStatus('Background generation paused. Check the Kokoro runtime.'); return; } ready += 1; }
  if (run === generationRun) setChapterStatus(`All ${state.chapters.length} chapters are ready to play.`);
}

function chooseChapter(index) { const chapter = state.chapters[index]; if (!chapter) return; const wasSpeaking = state.speaking; stopAudio(); state.chapterIndex = index; state.index = chapter.startIndex; renderPassage(); startBackgroundGeneration(); if (wasSpeaking) speakCurrent(); }

async function speakCurrent() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  const run = ++playbackRun; if (activeAudio) { activeAudio.pause(); activeAudio = null; } setEngineNote(`Preparing ${state.voice || 'a Kokoro voice'} locally…`);
  try {
    const url = await generateAudio(state.index); if (run !== playbackRun) return;
    const audio = new Audio(url); activeAudio = audio; audio.onplay = () => { setPlayState(true); setEngineNote(`Kokoro local runtime · ${state.voice} · no usage charge`); };
    audio.onended = () => { if (run !== playbackRun) return; setPlayState(false); if (state.index < state.passages.length - 1) { state.index += 1; renderPassage(); speakCurrent(); } else notify('You reached the end of this document.'); };
    audio.onerror = () => { if (run === playbackRun) { setPlayState(false); notify('Kokoro returned an unreadable audio file.'); } };
    if (state.index + 1 < state.passages.length) generateAudio(state.index + 1).catch(() => {}); await audio.play();
  } catch (error) { if (run === playbackRun) { setPlayState(false); setEngineNote(`Kokoro error · ${error.message}`); notify(error.message); } }
}

async function togglePlayback() {
  if (state.speaking && activeAudio) { activeAudio.pause(); setPlayState(false); return; }
  if (activeAudio?.paused && activeAudio.currentTime > 0) { try { await activeAudio.play(); } catch { speakCurrent(); } return; }
  speakCurrent();
}

async function extractPdf(file, key) {
  const currentExtraction = ++extractionId; notify('Reading your book locally…'); const pdfjs = await import('pdfjs-dist/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'; const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; let firstBatch = true;
  await processPagesInBatches(pdfDocument.numPages, async (pageNumber) => { const page = await pdfDocument.getPage(pageNumber); const content = await page.getTextContent(); return textItemsToText(content.items); }, (pages, pageNumber, pageCount) => { if (currentExtraction !== extractionId) return false; if (firstBatch) { firstBatch = false; setDocument(pages.join('\n'), file.name, pageNumber === pageCount, key); } else appendDocument(pages.join('\n'), pageNumber, pageCount); if (pageNumber === pageCount) { cacheBook(key, { text: state.sourceText, name: file.name }); notify(`${state.chapters.length} chapters ready to listen.`); } return true; }, 4);
}

async function handleFile(file) {
  if (!file) return; if (file.size > 512_000_000) { notify('Choose a book smaller than 512 MB.'); return; } const key = bookStorageKey(file); const cached = await getCachedBook(key);
  if (cached?.text) { extractionId += 1; setDocument(cached.text, cached.name || file.name, true, key); notify('Opened instantly from your private cache.'); return; }
  const name = file.name.toLowerCase();
  try {
    if (file.type === 'text/plain' || name.endsWith('.txt')) { extractionId += 1; const text = await file.text(); setDocument(text, file.name, true, key); cacheBook(key, { text, name: file.name }); }
    else if (file.type === 'application/pdf' || name.endsWith('.pdf')) await extractPdf(file, key);
    else if (file.type === 'application/epub+zip' || name.endsWith('.epub')) { extractionId += 1; notify('Opening EPUB chapters locally…'); const { extractEpub } = await import('./epub.mjs'); const book = await extractEpub(await file.arrayBuffer()); setDocument(book.text, book.title || file.name, true, key); cacheBook(key, { text: book.text, name: book.title || file.name }); }
    else notify('Please choose a readable PDF, EPUB, or TXT book.');
  } catch (error) { console.error(error); notify(error.message || 'I could not read that book. Try a readable file.'); }
}

$('#voiceSelect')?.addEventListener('change', (event) => chooseVoice(event.target.value)); $('#chapterSelect')?.addEventListener('change', (event) => chooseChapter(Number(event.target.value))); pdfInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); })); dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
$('#clearButton').addEventListener('click', () => { stopAudio(); clearAudioCache(); state.chapters = []; state.passages = []; state.sourceText = ''; state.documentComplete = false; state.generationStatus = 'Import a book to prepare its chapters.'; state.index = 0; state.chapterIndex = 0; state.fileName = ''; state.bookKey = ''; pdfInput.value = ''; localStorage.removeItem('zuna-file-name'); libraryPanel.hidden = true; renderChapterPicker(); renderPassage(); });
playButton.addEventListener('click', togglePlayback); $('#backButton').addEventListener('click', () => { stopAudio(); state.index = Math.max(0, state.index - 1); renderPassage(); }); $('#forwardButton').addEventListener('click', () => { stopAudio(); state.index = Math.min(Math.max(0, state.passages.length - 1), state.index + 1); renderPassage(); }); seek.addEventListener('input', () => { stopAudio(); state.index = Number(seek.value); renderPassage(); });
$('#speedSelect').value = String(state.speed); $('#speedSelect').addEventListener('change', (event) => { const wasSpeaking = state.speaking; stopAudio(); clearAudioCache(); state.speed = Number(event.target.value); localStorage.setItem('zuna-speed', state.speed); startBackgroundGeneration(); if (wasSpeaking) speakCurrent(); });
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => document.querySelectorAll('[data-nav]').forEach((item) => item.classList.toggle('is-active', item.dataset.nav === link.dataset.nav))));
window.addEventListener('focus', () => { if (!state.kokoroOnline) loadKokoroVoices(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !state.kokoroOnline) loadKokoroVoices(); });
const settingsDialog = $('#settingsDialog'); const openSettings = () => settingsDialog?.showModal(); $('#settingsButton')?.addEventListener('click', openSettings); $('#mobileSettingsButton')?.addEventListener('click', openSettings); $('#closeSettings')?.addEventListener('click', () => settingsDialog?.close()); $('#membershipButton')?.addEventListener('click', () => notify('We will keep a place for you. Zuna+ is coming soon.'));
$('#clearCacheButton')?.addEventListener('click', async () => { if (!window.confirm('Remove all cached book text and generated audio from this browser?')) return; const cleared = await clearLocalCache(); notify(cleared ? 'Private book and audio cache cleared.' : 'The local cache could not be cleared.'); });
renderChapterPicker(); if (state.fileName) $('#fileName').textContent = state.fileName; loadKokoroVoices();
