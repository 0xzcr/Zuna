import { processPagesInBatches } from './progressive-pages.mjs';
import { cleanText, splitIntoPassages, clampProgress } from './reader-core.mjs';
import { KOKORO_BASE_URL, normalizeVoices, groupVoices, synthesisPayload, audioCacheKey } from './kokoro-runtime.mjs?v=7';

const state = {
  passages: [], index: 0, voice: localStorage.getItem('zuna-kokoro-voice') || '',
  speed: Number(localStorage.getItem('zuna-speed') || 1), fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false, theme: localStorage.getItem('zuna-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  kokoroVoices: [], kokoroOnline: false,
};

const $ = (selector) => document.querySelector(selector);
const pdfInput = $('#pdfInput'); const dropZone = $('#dropZone'); const libraryPanel = $('#libraryPanel');
const passage = $('#passage'); const seek = $('#seek'); const playButton = $('#playButton'); const toast = $('#toast'); const engineNote = $('#engineNote');
const audioCache = new Map(); let activeAudio = null; let playbackRun = 0; let extractionId = 0;

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
  const wasSpeaking = state.speaking; stopAudio(); state.voice = voice; localStorage.setItem('zuna-kokoro-voice', voice); renderVoicePicker();
  if (wasSpeaking) speakCurrent();
}

async function loadKokoroVoices() {
  try {
    const response = await fetch(`${KOKORO_BASE_URL}/api/voices`, { cache: 'no-store', signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error('Voice endpoint unavailable');
    state.kokoroVoices = normalizeVoices(await response.json()); state.kokoroOnline = state.kokoroVoices.length > 0;
    if (!state.kokoroVoices.includes(state.voice)) { state.voice = state.kokoroVoices[0] || ''; if (state.voice) localStorage.setItem('zuna-kokoro-voice', state.voice); }
    setEngineNote(state.kokoroOnline ? `Kokoro local runtime · ${state.kokoroVoices.length} voices · all free` : 'Kokoro runtime is online but has no voice pack.');
  } catch { state.kokoroVoices = []; state.kokoroOnline = false; setEngineNote('Kokoro is offline · see backend/README.md to start the local runtime'); }
  renderVoicePicker();
}

function setDocument(text, name) {
  state.passages = splitIntoPassages(cleanText(text)); state.index = clampProgress(localStorage.getItem(`zuna-progress:${name}`), state.passages.length); state.fileName = name;
  localStorage.setItem('zuna-file-name', name); $('#fileName').textContent = name; $('#fileMeta').textContent = `${state.passages.length} passages · local only`; $('#nowPlayingLabel').textContent = name; libraryPanel.hidden = false;
  seek.max = Math.max(0, state.passages.length - 1); seek.value = state.index; renderPassage(); document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); notify(`${state.passages.length} passages ready to listen.`);
}

function appendDocument(text, page, pageCount) { state.passages.push(...splitIntoPassages(cleanText(text))); $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${page} / ${pageCount} · local only`; $('#nowPlayingLabel').textContent = state.fileName; seek.max = Math.max(0, state.passages.length - 1); }
function renderPassage() { const current = state.passages[state.index]; $('#progressLabel').textContent = state.passages.length ? `${state.index + 1} / ${state.passages.length}` : '0 / 0'; seek.value = state.index; if (!current) { passage.innerHTML = '<span class="passage-placeholder">Your current passage will appear here.</span>'; return; } passage.textContent = current; localStorage.setItem(`zuna-progress:${state.fileName}`, String(state.index)); }

function setPlayState(playing) { state.speaking = playing; playButton.textContent = playing ? 'Ⅱ' : '▶'; playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play'); playButton.setAttribute('aria-pressed', String(playing)); }
function clearAudioCache() { audioCache.forEach((url) => URL.revokeObjectURL(url)); audioCache.clear(); }
function stopAudio() { playbackRun += 1; if (activeAudio) { activeAudio.pause(); activeAudio.removeAttribute('src'); activeAudio = null; } setPlayState(false); }

async function generateAudio(index) {
  if (!state.kokoroOnline || !state.voice) throw new Error('Start the local Kokoro runtime and choose a voice first.');
  const key = audioCacheKey(index, state.voice, state.speed); if (audioCache.has(key)) return audioCache.get(key);
  const response = await fetch(`${KOKORO_BASE_URL}/api/synthesize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(synthesisPayload({ text: state.passages[index], voice: state.voice, speed: state.speed })) });
  if (!response.ok) { let message = 'Kokoro could not generate this passage.'; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
  const url = URL.createObjectURL(await response.blob()); audioCache.set(key, url); return url;
}

async function speakCurrent() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  const run = ++playbackRun; if (activeAudio) { activeAudio.pause(); activeAudio = null; } setEngineNote(`Preparing ${state.voice || 'a Kokoro voice'} locally…`);
  try {
    const url = await generateAudio(state.index); if (run !== playbackRun) return;
    const audio = new Audio(url); activeAudio = audio; audio.onplay = () => { setPlayState(true); setEngineNote(`Kokoro local runtime · ${state.voice} · no usage charge`); };
    audio.onended = () => { if (run !== playbackRun) return; setPlayState(false); if (state.index < state.passages.length - 1) { state.index += 1; renderPassage(); speakCurrent(); } else notify('You reached the end of this document.'); };
    audio.onerror = () => { if (run === playbackRun) { setPlayState(false); notify('Kokoro returned an unreadable audio file.'); } };
    await audio.play();
  } catch (error) { if (run === playbackRun) { setPlayState(false); setEngineNote(`Kokoro error · ${error.message}`); notify(error.message); } }
}

async function togglePlayback() {
  if (state.speaking && activeAudio) { activeAudio.pause(); setPlayState(false); return; }
  if (activeAudio?.paused && activeAudio.currentTime > 0) { try { await activeAudio.play(); } catch { speakCurrent(); } return; }
  speakCurrent();
}

async function extractPdf(file) {
  const currentExtraction = ++extractionId; notify('Reading your book locally…'); const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'; const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; let firstBatch = true;
  await processPagesInBatches(pdfDocument.numPages, async (pageNumber) => { const page = await pdfDocument.getPage(pageNumber); const content = await page.getTextContent(); return content.items.map((item) => item.str).join(' '); }, (pages, pageNumber, pageCount) => { if (currentExtraction !== extractionId) return false; if (firstBatch) { firstBatch = false; setDocument(pages.join('\n'), file.name); } else appendDocument(pages.join('\n'), pageNumber, pageCount); $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${pageNumber} / ${pageCount} · local only`; if (pageNumber === pageCount) notify(`${state.passages.length} passages ready to listen.`); return true; });
}

async function handleFile(file) { if (!file) return; if (file.type === 'text/plain' || file.name.endsWith('.txt')) { extractionId += 1; setDocument(await file.text(), file.name); } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) { try { await extractPdf(file); } catch (error) { console.error(error); notify('I could not read that book. Try a readable file.'); } } else notify('Please choose a readable book file (PDF or TXT).'); }

$('#voiceSelect')?.addEventListener('change', (event) => chooseVoice(event.target.value)); pdfInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); })); dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
$('#clearButton').addEventListener('click', () => { stopAudio(); clearAudioCache(); state.passages = []; state.index = 0; state.fileName = ''; pdfInput.value = ''; localStorage.removeItem('zuna-file-name'); libraryPanel.hidden = true; $('#nowPlayingLabel').textContent = 'Choose a document to begin'; renderPassage(); });
playButton.addEventListener('click', togglePlayback); $('#backButton').addEventListener('click', () => { stopAudio(); state.index = Math.max(0, state.index - 1); renderPassage(); }); $('#forwardButton').addEventListener('click', () => { stopAudio(); state.index = Math.min(Math.max(0, state.passages.length - 1), state.index + 1); renderPassage(); }); seek.addEventListener('input', () => { stopAudio(); state.index = Number(seek.value); renderPassage(); });
$('#speedSelect').value = String(state.speed); $('#speedSelect').addEventListener('change', (event) => { const wasSpeaking = state.speaking; stopAudio(); state.speed = Number(event.target.value); localStorage.setItem('zuna-speed', state.speed); if (wasSpeaking) speakCurrent(); });
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => document.querySelectorAll('[data-nav]').forEach((item) => item.classList.toggle('is-active', item.dataset.nav === link.dataset.nav))));
window.addEventListener('focus', () => { if (!state.kokoroOnline) loadKokoroVoices(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !state.kokoroOnline) loadKokoroVoices(); });
const settingsDialog = $('#settingsDialog'); const openSettings = () => settingsDialog?.showModal(); $('#settingsButton')?.addEventListener('click', openSettings); $('#mobileSettingsButton')?.addEventListener('click', openSettings); $('#closeSettings')?.addEventListener('click', () => settingsDialog?.close()); $('#membershipButton')?.addEventListener('click', () => notify('We will keep a place for you. Zuna+ is coming soon.'));
if (state.fileName) $('#fileName').textContent = state.fileName; loadKokoroVoices();
