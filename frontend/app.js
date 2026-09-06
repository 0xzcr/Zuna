import { processPagesInBatches } from './progressive-pages.mjs';
import { buildChapterMap, chapterGenerationWindow, chapterProgress, clampProgress, decodePlainText, hasReadableText, normalizePdfPages, textItemsToText } from './reader-core.mjs?v=12';
import { normalizeVoices, groupVoices, normalizeModelProgress, estimateModelRemainingSeconds, playbackPrefetchOrder, synthesisPayload, createAudioLru } from './kokoro-runtime.mjs?v=11';
import { browserKokoro } from './browser-kokoro.mjs';
import { audioStorageKey, bookStorageKey, cacheAudio, cacheBook, clearLocalCache, getCachedAudio, getCachedBook, listCachedBooks } from './local-cache.mjs';

const state = {
  chapters: [], passages: [], index: 0, chapterIndex: 0, sourceText: '', documentComplete: false, generationStatus: 'Import a book to prepare its chapters.',
  voice: localStorage.getItem('zuna-kokoro-voice') || '',
  speed: Number(localStorage.getItem('zuna-speed') || 1), fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false, theme: localStorage.getItem('zuna-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  kokoroVoices: [], kokoroOnline: false, kokoroBackend: '', kokoroLoading: false, kokoroLoadAttempted: false, kokoroLoadPromise: null, kokoroLoadPending: false, bookKey: '', savedBooks: [], readyPassages: new Set(), generatingChapterIndex: -1,
};

const $ = (selector) => document.querySelector(selector);
const pdfInput = $('#pdfInput'); const dropZone = $('#dropZone'); const libraryPanel = $('#libraryPanel');
const passage = $('#passage'); const seek = $('#seek'); const playButton = $('#playButton'); const toast = $('#toast'); const engineNote = $('#engineNote');
const audioCache = createAudioLru(undefined, (_key, url) => URL.revokeObjectURL(url)); const audioJobs = new Map(); let activeAudio = null; let activeAudioKey = ''; let queuedAudio = null; let queuedAudioKey = ''; let queuedAudioIndex = -1; let playbackRun = 0; let generationRun = 0; let extractionId = 0; let lastMappedPdfPage = 0; let modelLoadStartedAt = 0; let modelProgressValue = null; let modelProgressTimer = null; let modelSuspendTimer = null; let readerModelObserver = null;

function applyTheme(theme) {
  state.theme = theme; document.documentElement.dataset.theme = theme; localStorage.setItem('zuna-theme', theme);
  const toggle = $('#themeToggle'); if (toggle) { toggle.setAttribute('aria-pressed', String(theme === 'dark')); toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`); }
  const icon = $('#themeIcon'); if (icon) icon.textContent = theme === 'dark' ? '☾' : '☼';
}

applyTheme(state.theme); $('#themeToggle')?.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

function notify(message) { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 3400); }
function setEngineNote(message) { if (engineNote) engineNote.textContent = message; }
function setFirstRunNote(visible) { const note = $('#firstRunNote'); if (note) note.hidden = !visible; }
function formatModelTimeRemaining(seconds) {
  if (seconds === null) return 'Estimating time…';
  if (seconds <= 0) return 'Almost ready';
  if (seconds < 60) return `~${seconds}s remaining`;
  return `~${Math.ceil(seconds / 60)}m remaining`;
}
function updateModelTimeRemaining() {
  const time = $('#modelTimeRemaining'); if (!time || !modelLoadStartedAt) return;
  time.textContent = formatModelTimeRemaining(estimateModelRemainingSeconds(modelProgressValue, performance.now() - modelLoadStartedAt));
}
function setModelProgress(progress, phase = 'downloading') {
  const loading = $('#modelLoading'); const meter = $('#modelProgress'); const label = $('#modelProgressLabel'); const phaseLabel = $('#modelPhaseLabel'); if (!loading || !meter || !label) return;
  modelProgressValue = Number.isFinite(progress) ? progress : null; const value = normalizeModelProgress(progress); loading.hidden = false;
  if (phaseLabel) phaseLabel.textContent = phase === 'starting' ? 'Starting Kokoro' : phase === 'finalizing' ? 'Finalizing Kokoro' : 'Downloading Kokoro';
  if (value === null) { meter.removeAttribute('value'); label.textContent = '—'; }
  else { meter.value = value; label.textContent = `${value}%`; }
  updateModelTimeRemaining();
}
function startModelProgress() {
  modelLoadStartedAt = performance.now(); modelProgressValue = 0; clearInterval(modelProgressTimer); setModelProgress(0); modelProgressTimer = setInterval(updateModelTimeRemaining, 1000);
}
function finishModelProgress() { clearInterval(modelProgressTimer); modelProgressTimer = null; modelLoadStartedAt = 0; modelProgressValue = null; }
function hideModelProgress() { finishModelProgress(); const loading = $('#modelLoading'); if (loading) loading.hidden = true; }
function languageName(voice) { return ({ af: 'American English', am: 'American English', bf: 'British English', bm: 'British English', ef: 'Spanish', em: 'Spanish', ff: 'French', hf: 'Hindi', hm: 'Hindi', if: 'Italian', im: 'Italian', jf: 'Japanese', jm: 'Japanese', pf: 'Brazilian Portuguese', pm: 'Brazilian Portuguese', zf: 'Mandarin', zm: 'Mandarin' })[voice.slice(0, 2)] || 'Kokoro voice'; }
function voiceDisplayName(voice) { return voice.slice(3).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || voice; }

function renderVoicePicker() {
  const select = $('#voiceSelect'); if (!select) return;
  const picker = document.querySelector('.voice-picker');
  let retry = $('#retryKokoro');
  if (!retry && picker) { retry = document.createElement('button'); retry.id = 'retryKokoro'; retry.className = 'retry-button'; retry.type = 'button'; retry.addEventListener('click', loadKokoroVoices); picker.append(retry); }
  if (retry) retry.hidden = state.kokoroOnline;
  if (retry) { retry.disabled = state.kokoroLoading; retry.textContent = state.kokoroLoading ? 'Loading…' : state.kokoroLoadAttempted ? 'Retry model' : 'Load Kokoro'; }
  select.replaceChildren();
  if (!state.kokoroVoices.length) {
    const option = document.createElement('option'); option.textContent = state.kokoroLoading ? 'Loading Kokoro on this device…' : 'Load Kokoro to choose a voice'; select.append(option); select.disabled = true;
    const count = $('#voiceCount'); if (count) count.textContent = state.kokoroLoading ? 'Model loading' : 'Loads when you need it'; return;
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
  if (state.kokoroOnline) return;
  if (state.kokoroLoadPromise) return state.kokoroLoadPromise;
  state.kokoroLoading = true; state.kokoroLoadAttempted = true; renderVoicePicker(); setFirstRunNote(true);
  startModelProgress();
  state.kokoroLoadPromise = (async () => {
    try {
      const result = await browserKokoro().load((detail) => {
        if (detail.status === 'fallback') { setEngineNote('WebGPU unavailable · switching to optimized WASM…'); modelLoadStartedAt = performance.now(); setModelProgress(0); }
        else if (detail.status === 'progress' && Number.isFinite(detail.progress)) { const progress = normalizeModelProgress(detail.progress); const phase = progress >= 100 ? 'finalizing' : 'downloading'; setEngineNote(phase === 'finalizing' ? 'Finalizing Kokoro on this device…' : `Downloading Kokoro ${detail.backend.toUpperCase()} once · ${progress}%`); setModelProgress(detail.progress, phase); }
        else if (detail.status === 'loading') { setEngineNote(`Starting Kokoro with ${detail.backend.toUpperCase()}…`); setModelProgress(null, 'starting'); }
        else if (detail.status === 'ready') { setEngineNote('Kokoro is ready on this device.'); setModelProgress(100, 'finalizing'); }
      });
      state.kokoroVoices = normalizeVoices(result.voices); state.kokoroOnline = state.kokoroVoices.length > 0; state.kokoroBackend = result.backend;
      if (!state.kokoroVoices.includes(state.voice)) { state.voice = state.kokoroVoices[0] || ''; if (state.voice) localStorage.setItem('zuna-kokoro-voice', state.voice); }
      setEngineNote(state.kokoroOnline ? `Kokoro runs on this device · ${state.kokoroBackend.toUpperCase()} · ${state.kokoroVoices.length} free voices` : 'Kokoro loaded without a compatible voice pack.'); setFirstRunNote(false); hideModelProgress();
    } catch (error) {
      state.kokoroVoices = []; state.kokoroOnline = false;
      if (error?.name === 'AbortError') { state.kokoroLoadPending = true; setFirstRunNote(true); setEngineNote('Kokoro paused while this tab was inactive.'); }
      else { setFirstRunNote(true); setEngineNote(`Kokoro could not start · ${error.message}`); }
      hideModelProgress();
    }
    state.kokoroLoading = false; state.kokoroLoadPromise = null; renderVoicePicker(); if (state.kokoroOnline && state.documentComplete) startBackgroundGeneration();
    if (state.kokoroLoadPending && document.visibilityState === 'visible') requestKokoroLoad();
  })();
  return state.kokoroLoadPromise;
}

function chapterForPassage(index) { return Math.max(0, state.chapters.findIndex((chapter) => index >= chapter.startIndex && index <= chapter.endIndex)); }
function setChapterStatus(message) { state.generationStatus = message; const status = $('#chapterStatus'); if (status) status.textContent = message; }
function updateChapterCard(index) {
  const card = document.querySelector(`[data-chapter-index="${index}"]`); const chapter = state.chapters[index]; if (!card || !chapter) return;
  const progress = chapterProgress(chapter, state.readyPassages); const meter = card.querySelector('progress'); const label = card.querySelector('.chapter-card-progress');
  meter.value = progress.ready; meter.max = Math.max(1, progress.total); meter.setAttribute('aria-valuetext', `${progress.ready} of ${progress.total} passages ready`);
  label.textContent = progress.percent === 100 ? 'Ready to play' : state.generatingChapterIndex === index ? `${progress.percent}% · generating` : `${progress.percent}% ready`;
  card.classList.toggle('is-ready', progress.percent === 100); card.classList.toggle('is-generating', state.generatingChapterIndex === index);
}
function updateChapterSelection(scroll = false) {
  const rail = $('#chapterRail');
  document.querySelectorAll('[data-chapter-index]').forEach((card) => {
    const selected = Number(card.dataset.chapterIndex) === state.chapterIndex;
    card.classList.toggle('is-selected', selected); card.setAttribute('aria-pressed', String(selected));
    if (selected && scroll && rail) {
      const target = card.offsetLeft - (rail.clientWidth - card.offsetWidth) / 2;
      rail.scrollTo({ left: Math.max(0, Math.min(target, rail.scrollWidth - rail.clientWidth)), behavior: 'smooth' });
    }
  });
}
function renderChapterPicker() {
  const rail = $('#chapterRail'); if (!rail) return; rail.replaceChildren();
  if (!state.chapters.length) { const empty = document.createElement('span'); empty.className = 'chapter-empty'; empty.textContent = 'Choose a book first…'; rail.append(empty); setChapterStatus(state.generationStatus); return; }
  state.chapters.forEach((chapter, index) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'chapter-card'; card.dataset.chapterIndex = String(index); card.setAttribute('aria-pressed', String(index === state.chapterIndex)); card.addEventListener('click', () => chooseChapter(index));
    const number = document.createElement('span'); number.className = 'chapter-card-number'; number.textContent = String(index + 1).padStart(2, '0');
    const title = document.createElement('strong'); title.textContent = chapter.title;
    const meter = document.createElement('progress'); meter.className = 'chapter-progress'; meter.setAttribute('aria-label', `${chapter.title} voice generation`);
    const progressLabel = document.createElement('span'); progressLabel.className = 'chapter-card-progress';
    card.append(number, title, meter, progressLabel); rail.append(card); updateChapterCard(index);
  });
  updateChapterSelection(); setChapterStatus(state.generationStatus);
}

function renderSavedBooks() {
  const shelf = $('#savedShelf'); const rail = $('#savedBookRail'); if (!shelf || !rail) return; rail.replaceChildren(); shelf.hidden = !state.savedBooks.length;
  $('#savedBookCount').textContent = `${state.savedBooks.length} ${state.savedBooks.length === 1 ? 'book' : 'books'}`;
  state.savedBooks.forEach((book) => {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'saved-book-card'; card.classList.toggle('is-selected', book.key === state.bookKey); card.addEventListener('click', () => openSavedBook(book.key));
    const mark = document.createElement('span'); mark.className = 'saved-book-mark'; mark.textContent = '▱';
    const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = book.name || 'Saved book'; const detail = document.createElement('small'); detail.textContent = book.key === state.bookKey ? 'Currently open' : 'Open instantly'; copy.append(title, detail);
    const arrow = document.createElement('span'); arrow.className = 'saved-book-arrow'; arrow.textContent = '↗'; card.append(mark, copy, arrow); rail.append(card);
  });
}
async function refreshSavedBooks() { state.savedBooks = await listCachedBooks(); renderSavedBooks(); }
async function openSavedBook(key) { const book = await getCachedBook(key); if (!book?.text) { notify('That saved book is no longer available.'); refreshSavedBooks(); return; } extractionId += 1; setDocument(book.text, book.name || 'Saved book', true, key); requestKokoroLoad(); notify('Opened instantly from your private shelf.'); }

function requestKokoroLoad() {
  if (document.visibilityState === 'hidden') { state.kokoroLoadPending = true; setEngineNote('Kokoro will load when this tab is active.'); return Promise.resolve(); }
  state.kokoroLoadPending = false; return loadKokoroVoices();
}

function suspendInactiveRuntime() {
  if (document.visibilityState !== 'hidden' || state.speaking || (!state.kokoroOnline && !state.kokoroLoading)) return;
  generationRun += 1; stopAudio(); clearAudioCache(); browserKokoro().release();
  state.kokoroOnline = false; state.kokoroVoices = []; state.kokoroBackend = ''; state.kokoroLoadPending = true; setFirstRunNote(true); setEngineNote('Kokoro paused while this tab was inactive.'); renderVoicePicker();
}
function scheduleInactiveRuntimeRelease() {
  clearTimeout(modelSuspendTimer);
  if (state.kokoroOnline || state.kokoroLoading) modelSuspendTimer = setTimeout(suspendInactiveRuntime, 15_000);
}
function watchReaderForModel() {
  const reader = $('#reader'); if (!reader || !('IntersectionObserver' in window)) return;
  readerModelObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    readerModelObserver.disconnect(); readerModelObserver = null; requestKokoroLoad();
  }, { rootMargin: '160px 0px' });
  readerModelObserver.observe(reader);
}

function applyChapterMap(preservePosition = false) {
  const currentPassage = preservePosition ? state.passages[state.index] : null; const book = buildChapterMap(state.sourceText); state.chapters = book.chapters; state.passages = book.passages;
  const savedIndex = localStorage.getItem(`zuna-progress:${state.fileName}`); const firstChapterIndex = state.chapters[book.defaultChapterIndex]?.startIndex || 0; const preservedIndex = currentPassage ? state.passages.indexOf(currentPassage) : -1;
  state.index = preservedIndex >= 0 ? preservedIndex : clampProgress(preservePosition ? state.index : savedIndex ?? firstChapterIndex, state.passages.length);
  state.chapterIndex = state.passages.length ? chapterForPassage(state.index) : book.defaultChapterIndex; seek.max = Math.max(0, state.passages.length - 1); renderChapterPicker(); renderPassage();
}

function setDocument(text, name, complete = true, bookKey = state.bookKey) {
  stopAudio(); clearAudioCache(); generationRun += 1; state.sourceText = text; state.documentComplete = complete; state.fileName = name; state.bookKey = bookKey; state.generationStatus = complete ? 'Narration queued in the background.' : 'Finding chapters as pages load…'; applyChapterMap(); renderSavedBooks();
  localStorage.setItem('zuna-file-name', name); $('#fileName').textContent = name; $('#fileMeta').textContent = `${state.chapters.length} chapters · ${state.passages.length} passages · local only`; libraryPanel.hidden = false;
  notify(`${state.chapters.length || 1} chapters ready to choose.`); if (complete) startBackgroundGeneration(); else warmCurrentPassage();
}

function appendDocument(text, page, pageCount) {
  state.sourceText += `\n\n${text}`; state.generationStatus = 'Finding chapters as pages load…';
  if (page - lastMappedPdfPage >= 16) { lastMappedPdfPage = page; applyChapterMap(true); }
  $('#fileMeta').textContent = `${state.chapters.length} chapters · ${state.passages.length} passages · reading page ${page} / ${pageCount}`;
}
function finishDocument(text, name, key) {
  if (state.bookKey !== key) { setDocument(text, name, true, key); return; }
  generationRun += 1; lastMappedPdfPage = 0; state.sourceText = text; state.documentComplete = true; state.generationStatus = 'Narration queued in the background.'; applyChapterMap(true);
  $('#fileMeta').textContent = `${state.chapters.length} chapters · ${state.passages.length} passages · local only`; startBackgroundGeneration();
}
function renderPassage() { const current = state.passages[state.index]; state.chapterIndex = current ? chapterForPassage(state.index) : state.chapterIndex; const chapter = state.chapters[state.chapterIndex]; updateChapterSelection(); $('#nowPlayingLabel').textContent = state.fileName ? `${state.fileName} · ${chapter?.title || 'Full book'}` : 'Choose a document to begin'; $('#progressLabel').textContent = state.passages.length ? `${state.index + 1} / ${state.passages.length}` : '0 / 0'; seek.value = state.index; if (!current) { passage.innerHTML = '<span class="passage-placeholder">Your current passage will appear here.</span>'; return; } passage.textContent = current; localStorage.setItem(`zuna-progress:${state.fileName}`, String(state.index)); }

function setPlayState(playing) { state.speaking = playing; playButton.textContent = playing ? 'Ⅱ' : '▶'; playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play'); playButton.setAttribute('aria-pressed', String(playing)); }
function cancelPendingGeneration() { browserKokoro().cancelSynthesis(); audioJobs.clear(); }
function clearAudioCache() { generationRun += 1; cancelPendingGeneration(); audioCache.clear(); state.readyPassages.clear(); state.generatingChapterIndex = -1; state.chapters.forEach((_, index) => updateChapterCard(index)); }
function discardAudio(audio) { if (!audio) return; audio.pause(); audio.removeAttribute('src'); audio.load(); }
function stopAudio() { playbackRun += 1; if (activeAudioKey) audioCache.unpin(activeAudioKey); if (queuedAudioKey) audioCache.unpin(queuedAudioKey); discardAudio(activeAudio); discardAudio(queuedAudio); activeAudio = null; activeAudioKey = ''; queuedAudio = null; queuedAudioKey = ''; queuedAudioIndex = -1; setPlayState(false); }

function narrationContext() { return `${state.bookKey}|${state.voice}|${state.speed}`; }
function passageAudioKey(index) { const text = state.passages[index]; return text ? audioStorageKey({ bookKey: state.bookKey || state.fileName, index, voice: state.voice, speed: state.speed, text }) : ''; }
function markPassageReady(index, context) { if (context !== narrationContext() || state.readyPassages.has(index)) return; state.readyPassages.add(index); updateChapterCard(chapterForPassage(index)); }
function setGeneratingChapter(index) { const previous = state.generatingChapterIndex; state.generatingChapterIndex = index; if (previous >= 0) updateChapterCard(previous); if (index >= 0) updateChapterCard(index); }

async function generateAudio(index, priority = 50) {
  if (!state.kokoroOnline || !state.voice) throw new Error('Wait for Kokoro to finish loading, then choose a voice.');
  const text = state.passages[index]; const context = narrationContext();
  const key = audioStorageKey({ bookKey: state.bookKey || state.fileName, index, voice: state.voice, speed: state.speed, text });
  if (audioCache.has(key)) { markPassageReady(index, context); return audioCache.get(key); }
  if (audioJobs.has(key)) { const url = await audioJobs.get(key); markPassageReady(index, context); return url; }
  const job = (async () => { const stored = await getCachedAudio(key); if (stored) { const storedUrl = URL.createObjectURL(stored); audioCache.set(key, storedUrl, stored.size); return storedUrl; }
    const blob = await browserKokoro().synthesize(synthesisPayload({ text, voice: state.voice, speed: state.speed }), { priority });
    cacheAudio(key, blob); const url = URL.createObjectURL(blob); audioCache.set(key, url, blob.size); return url; })();
  audioJobs.set(key, job); try { const url = await job; markPassageReady(index, context); return url; } finally { if (audioJobs.get(key) === job) audioJobs.delete(key); }
}

function warmCurrentPassage() {
  if (state.kokoroOnline && state.voice && state.passages[state.index]) generateAudio(state.index, 80).catch(() => {});
}

async function startBackgroundGeneration() {
  const run = ++generationRun; setGeneratingChapter(-1); if (!state.documentComplete) return; if (!state.passages.length) { setChapterStatus('No readable chapter text was found.'); return; }
  if (!state.kokoroOnline || !state.voice) { setChapterStatus('Generation will begin when Kokoro is online.'); return; }
  const order = chapterGenerationWindow(state.chapters, state.chapterIndex, 2); let ready = 0;
  for (const index of order) { if (run !== generationRun) return; if (document.visibilityState === 'hidden') { setGeneratingChapter(-1); setChapterStatus('Background generation paused while this tab is inactive.'); return; } const chapterIndex = chapterForPassage(index); const chapter = state.chapters[chapterIndex]; setGeneratingChapter(chapterIndex); setChapterStatus(`Preparing ${chapter.title} · ${ready} / ${order.length} passages`);
    try { await generateAudio(index, chapterIndex === state.chapterIndex ? 20 : 5); } catch { if (run === generationRun) { setGeneratingChapter(-1); setChapterStatus('Background generation paused. Check the Kokoro runtime.'); } return; } ready += 1; }
  if (run === generationRun) { setGeneratingChapter(-1); const windowSize = Math.min(2, Math.max(0, state.chapters.length - state.chapterIndex)); setChapterStatus(`${windowSize === 1 ? 'Current chapter' : 'Current and next chapter'} ready to play.`); }
}

function chooseChapter(index) { const chapter = state.chapters[index]; if (!chapter) return; const wasSpeaking = state.speaking; stopAudio(); cancelPendingGeneration(); state.chapterIndex = index; state.index = chapter.startIndex; renderPassage(); updateChapterSelection(true); startBackgroundGeneration(); if (wasSpeaking) speakCurrent(); }
function moveToPassage(index) { stopAudio(); cancelPendingGeneration(); state.index = clampProgress(index, state.passages.length); renderPassage(); warmCurrentPassage(); startBackgroundGeneration(); }

async function prepareFollowingAudio(run, index) {
  const [nextIndex] = playbackPrefetchOrder(index, state.passages.length, 1);
  if (nextIndex === undefined || queuedAudioIndex === nextIndex) return;
  try {
    const nextJob = generateAudio(nextIndex, 40);
    const url = await nextJob; if (run !== playbackRun) return;
    if (queuedAudioKey) audioCache.unpin(queuedAudioKey);
    discardAudio(queuedAudio); queuedAudio = new Audio(url); queuedAudio.preload = 'auto'; queuedAudioIndex = nextIndex; queuedAudio.load();
    queuedAudioKey = passageAudioKey(nextIndex); audioCache.pin(queuedAudioKey);
  } catch {}
}

async function playPassage(run, index, preparedAudio = null, preparedKey = '') {
  try {
    const audio = preparedAudio || new Audio(await generateAudio(index, 100)); if (run !== playbackRun) return;
    const key = preparedKey || passageAudioKey(index); audioCache.pin(key); activeAudioKey = key;
    activeAudio = audio; audio.preload = 'auto';
    audio.onplay = () => { setPlayState(true); setEngineNote(`Kokoro on-device · ${state.kokoroBackend.toUpperCase()} · ${state.voice}`); };
    audio.onended = () => {
      if (run !== playbackRun) return;
      const nextIndex = index + 1; if (nextIndex >= state.passages.length) { setPlayState(false); notify('You reached the end of this document.'); return; }
      const previousKey = activeAudioKey; if (previousKey) audioCache.unpin(previousKey); activeAudioKey = '';
      state.index = nextIndex; renderPassage(); const nextAudio = queuedAudioIndex === nextIndex ? queuedAudio : null; const nextKey = nextAudio ? queuedAudioKey : ''; if (!nextAudio && queuedAudioKey) audioCache.unpin(queuedAudioKey); queuedAudio = null; queuedAudioKey = ''; queuedAudioIndex = -1;
      if (!nextAudio) { setPlayState(false); setEngineNote('Buffering the next passage on this device…'); }
      playPassage(run, nextIndex, nextAudio, nextKey);
    };
    audio.onerror = () => { if (run === playbackRun) { setPlayState(false); notify('Kokoro generated an unreadable audio file.'); } };
    prepareFollowingAudio(run, index); await audio.play();
  } catch (error) { if (run === playbackRun) { setPlayState(false); setEngineNote(`Kokoro error · ${error.message}`); notify(error.message); } }
}

function speakCurrent() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  if (!state.kokoroOnline) { notify('Loading Kokoro on this device…'); loadKokoroVoices().then(() => { if (state.kokoroOnline) speakCurrent(); }); return; }
  const run = ++playbackRun; discardAudio(activeAudio); discardAudio(queuedAudio); activeAudio = null; queuedAudio = null; queuedAudioIndex = -1;
  setEngineNote(`Preparing ${state.voice || 'a Kokoro voice'} on this device…`); playPassage(run, state.index);
}

async function togglePlayback() {
  if (state.speaking && activeAudio) { activeAudio.pause(); setPlayState(false); return; }
  if (activeAudio?.paused && activeAudio.currentTime > 0) { try { await activeAudio.play(); } catch { speakCurrent(); } return; }
  speakCurrent();
}

async function extractPdf(file, key) {
  const currentExtraction = ++extractionId; notify('Reading your book locally…'); const pdfjs = await import('pdfjs-dist/build/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }); let passwordCancelled = false; let pdfDocument;
  let shouldLoadModel = false;
  loadingTask.onPassword = (updatePassword) => { const password = window.prompt('This PDF is password protected. Enter its password to open it locally:'); if (password === null) { passwordCancelled = true; loadingTask.destroy(); } else updatePassword(password); };
  try {
    try { pdfDocument = await loadingTask.promise; } catch (error) { if (passwordCancelled) throw new Error('The password-protected PDF was not opened.'); throw error; }
    const extractedPages = []; let started = false;
    await processPagesInBatches(pdfDocument.numPages, async (pageNumber) => {
      const page = await pdfDocument.getPage(pageNumber);
      try { const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false }); return textItemsToText(content.items); }
      finally { page.cleanup(); }
    }, (pages, pageNumber, pageCount) => {
      if (currentExtraction !== extractionId) return false;
      extractedPages.push(...pages); const batchText = pages.join('\n\n');
      if (!started && hasReadableText(batchText)) { started = true; lastMappedPdfPage = pageNumber; setDocument(extractedPages.join('\n\n'), file.name, false, key); }
      else if (started) appendDocument(batchText, pageNumber, pageCount);
      return true;
    }, 4);
    if (currentExtraction !== extractionId) return;
    const text = normalizePdfPages(extractedPages);
    if (!hasReadableText(text)) throw new Error('No selectable text was found. This looks like a scanned PDF and needs OCR.');
    finishDocument(text, file.name, key); shouldLoadModel = true; await cacheBook(key, { text, name: file.name }); await refreshSavedBooks(); notify(`${state.chapters.length} chapters ready to listen.`);
  } finally { try { await pdfDocument?.cleanup(); } finally { await loadingTask.destroy(); } if (shouldLoadModel && !state.kokoroOnline) requestKokoroLoad(); }
}

async function handleFile(file) {
  if (!file) return; if (file.size > 512_000_000) { notify('Choose a book smaller than 512 MB.'); return; } const key = bookStorageKey(file); const cached = await getCachedBook(key);
  if (cached?.text) { extractionId += 1; setDocument(cached.text, cached.name || file.name, true, key); requestKokoroLoad(); notify('Opened instantly from your private cache.'); return; }
  const name = file.name.toLowerCase();
  try {
    if (file.type === 'text/plain' || name.endsWith('.txt')) { extractionId += 1; const text = decodePlainText(await file.arrayBuffer()); if (!hasReadableText(text)) throw new Error('This text file does not contain readable book text.'); setDocument(text, file.name, true, key); await cacheBook(key, { text, name: file.name }); await refreshSavedBooks(); requestKokoroLoad(); }
    else if (file.type === 'application/pdf' || name.endsWith('.pdf')) await extractPdf(file, key);
    else if (file.type === 'application/epub+zip' || name.endsWith('.epub')) { extractionId += 1; notify('Opening EPUB chapters locally…'); const { extractEpub } = await import('./epub.mjs'); const book = await extractEpub(await file.arrayBuffer()); setDocument(book.text, book.title || file.name, true, key); await cacheBook(key, { text: book.text, name: book.title || file.name }); await refreshSavedBooks(); requestKokoroLoad(); }
    else notify('Please choose a readable PDF, EPUB, or TXT book.');
  } catch (error) { console.error(error); notify(error.message || 'I could not read that book. Try a readable file.'); }
}

$('#voiceSelect')?.addEventListener('change', (event) => chooseVoice(event.target.value)); pdfInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); })); dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
$('#clearButton').addEventListener('click', () => { stopAudio(); clearAudioCache(); state.chapters = []; state.passages = []; state.sourceText = ''; state.documentComplete = false; state.generationStatus = 'Import a book to prepare its chapters.'; state.index = 0; state.chapterIndex = 0; state.fileName = ''; state.bookKey = ''; pdfInput.value = ''; localStorage.removeItem('zuna-file-name'); libraryPanel.hidden = true; renderChapterPicker(); renderPassage(); renderSavedBooks(); });
$('#chapterPrevious')?.addEventListener('click', () => $('#chapterRail')?.scrollBy({ left: -Math.max(220, $('#chapterRail').clientWidth * .75), behavior: 'smooth' }));
$('#chapterNext')?.addEventListener('click', () => $('#chapterRail')?.scrollBy({ left: Math.max(220, $('#chapterRail').clientWidth * .75), behavior: 'smooth' }));
playButton.addEventListener('click', togglePlayback); $('#backButton').addEventListener('click', () => moveToPassage(state.index - 1)); $('#forwardButton').addEventListener('click', () => moveToPassage(state.index + 1)); seek.addEventListener('input', () => moveToPassage(Number(seek.value)));
$('#speedSelect').value = String(state.speed); $('#speedSelect').addEventListener('change', (event) => { const wasSpeaking = state.speaking; stopAudio(); clearAudioCache(); state.speed = Number(event.target.value); localStorage.setItem('zuna-speed', state.speed); startBackgroundGeneration(); if (wasSpeaking) speakCurrent(); });
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => document.querySelectorAll('[data-nav]').forEach((item) => item.classList.toggle('is-active', item.dataset.nav === link.dataset.nav))));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    generationRun += 1;
    if (state.documentComplete && !state.speaking) setChapterStatus('Background generation paused while this tab is inactive.');
    if (state.kokoroLoading) { state.kokoroLoadPending = true; browserKokoro().release(); }
    else scheduleInactiveRuntimeRelease();
    return;
  }
  clearTimeout(modelSuspendTimer); modelSuspendTimer = null;
  if (state.kokoroLoadPending) requestKokoroLoad();
  if (state.kokoroOnline && state.documentComplete) startBackgroundGeneration();
});
const settingsDialog = $('#settingsDialog'); const openSettings = () => settingsDialog?.showModal(); $('#settingsButton')?.addEventListener('click', openSettings); $('#mobileSettingsButton')?.addEventListener('click', openSettings); $('#closeSettings')?.addEventListener('click', () => settingsDialog?.close());
$('#clearCacheButton')?.addEventListener('click', async () => { if (!window.confirm('Remove all cached book text and generated audio from this browser?')) return; const cleared = await clearLocalCache(); if (cleared) { state.savedBooks = []; renderSavedBooks(); } notify(cleared ? 'Private book and audio cache cleared.' : 'The local cache could not be cleared.'); });
renderChapterPicker(); renderVoicePicker(); if (state.fileName) $('#fileName').textContent = state.fileName; refreshSavedBooks(); watchReaderForModel();
