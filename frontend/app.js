import { processPagesInBatches } from './progressive-pages.mjs';
import { cleanText, splitIntoPassages, clampProgress } from './reader-core.mjs';

const state = {
  passages: [],
  index: 0,
  narrator: localStorage.getItem('zuna-narrator') || 'elias',
  speed: Number(localStorage.getItem('zuna-speed') || 1),
  fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false,
  theme: localStorage.getItem('zuna-theme') || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
};

const $ = (selector) => document.querySelector(selector);
const pdfInput = $('#pdfInput');
const dropZone = $('#dropZone');
const libraryPanel = $('#libraryPanel');
const passage = $('#passage');
const seek = $('#seek');
const playButton = $('#playButton');
const toast = $('#toast');
const engineNote = $('#engineNote');
let extractionId = 0;

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('zuna-theme', theme);
  const toggle = $('#themeToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
  const icon = $('#themeIcon');
  if (icon) icon.textContent = theme === 'dark' ? '☾' : '☼';
  const settingsTheme = $('#settingsTheme');
  if (settingsTheme) settingsTheme.textContent = theme.toUpperCase();
}

applyTheme(state.theme);
$('#themeToggle')?.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark'));

function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
}

function setDocument(text, name) {
  state.passages = splitIntoPassages(cleanText(text));
  state.index = clampProgress(localStorage.getItem(`zuna-progress:${name}`), state.passages.length);
  state.fileName = name;
  localStorage.setItem('zuna-file-name', name);
  $('#fileName').textContent = name;
  $('#fileMeta').textContent = `${state.passages.length} passages · local only`;
  $('#nowPlayingLabel').textContent = name;
  libraryPanel.hidden = false;
  seek.max = Math.max(0, state.passages.length - 1);
  seek.value = state.index;
  renderPassage();
  document.querySelector('.player')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify(`${state.passages.length} passages ready to listen.`);
}

function appendDocument(text, page, pageCount) {
  state.passages.push(...splitIntoPassages(cleanText(text)));
  $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${page} / ${pageCount} · local only`;
  $('#nowPlayingLabel').textContent = state.fileName;
  seek.max = Math.max(0, state.passages.length - 1);
}

function renderPassage() {
  const current = state.passages[state.index];
  $('#progressLabel').textContent = state.passages.length ? `${state.index + 1} / ${state.passages.length}` : '0 / 0';
  seek.value = state.index;
  if (!current) {
    passage.innerHTML = '<span class="passage-placeholder">Your current passage will appear here.</span>';
    return;
  }
  passage.textContent = current;
  localStorage.setItem(`zuna-progress:${state.fileName}`, String(state.index));
}

const narratorProfiles = {
  elias: { pitch: .68, rate: .88, names: ['Alex', 'Daniel', 'Fred', 'Thomas', 'Arthur', 'Oliver', 'David', 'Mark', 'Male'] },
  mira: { pitch: 1.18, rate: 1.04, names: ['Samantha', 'Karen', 'Victoria', 'Moira', 'Ava', 'Zoe', 'Siri', 'Female', 'Google US English'] },
};

function setEngineNote(message) { engineNote.textContent = message; }

function stopAudio() {
  window.speechSynthesis?.cancel();
  state.speaking = false;
  playButton.textContent = '▶';
  playButton.setAttribute('aria-label', 'Play');
  playButton.setAttribute('aria-pressed', 'false');
}

function fallbackSpeechAvailable() { return 'speechSynthesis' in window; }

function fallbackVoice(narrator = state.narrator) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith('en'));
  const profile = narratorProfiles[narrator];
  return english.find((voice) => profile.names.some((name) => voice.name.toLowerCase().includes(name.toLowerCase()))) || english[0] || voices[0];
}

function speakWithBrowser() {
  if (!fallbackSpeechAvailable()) {
    setEngineNote('Narration is not available in this browser.');
    notify('This browser does not provide local speech playback.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(state.passages[state.index]);
  const profile = narratorProfiles[state.narrator];
  utterance.rate = state.speed * profile.rate;
  utterance.pitch = profile.pitch;
  utterance.voice = fallbackVoice(state.narrator);
  utterance.onstart = () => { state.speaking = true; playButton.textContent = 'Ⅱ'; playButton.setAttribute('aria-label', 'Pause'); playButton.setAttribute('aria-pressed', 'true'); setEngineNote('Browser speech narration · processed locally'); };
  utterance.onend = () => {
    state.speaking = false;
    playButton.textContent = '▶';
    playButton.setAttribute('aria-label', 'Play');
    playButton.setAttribute('aria-pressed', 'false');
    if (state.index < state.passages.length - 1) { state.index += 1; renderPassage(); speakCurrent(); }
    else notify('You reached the end of this document.');
  };
  utterance.onerror = () => { state.speaking = false; playButton.textContent = '▶'; playButton.setAttribute('aria-label', 'Play'); notify('The browser could not start narration.'); };
  window.speechSynthesis.speak(utterance);
}

function speakCurrent() { if (state.passages.length) speakWithBrowser(); }

function togglePlayback() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  if (state.speaking) { window.speechSynthesis.pause(); state.speaking = false; playButton.textContent = '▶'; playButton.setAttribute('aria-label', 'Play'); playButton.setAttribute('aria-pressed', 'false'); }
  else if (window.speechSynthesis?.paused) { window.speechSynthesis.resume(); state.speaking = true; playButton.textContent = 'Ⅱ'; playButton.setAttribute('aria-label', 'Pause'); playButton.setAttribute('aria-pressed', 'true'); }
  else speakCurrent();
}

async function extractPdf(file) {
  const currentExtraction = ++extractionId;
  notify('Reading your book locally…');
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let firstBatch = true;
  await processPagesInBatches(pdfDocument.numPages, async (pageNumber) => {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str).join(' ');
  }, (pages, pageNumber, pageCount) => {
    if (currentExtraction !== extractionId) return false;
    if (firstBatch) { firstBatch = false; setDocument(pages.join('\n'), file.name); }
    else appendDocument(pages.join('\n'), pageNumber, pageCount);
    $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${pageNumber} / ${pageCount} · local only`;
    if (pageNumber === pageCount) notify(`${state.passages.length} passages ready to listen.`);
    return true;
  });
}

async function handleFile(file) {
  if (!file) return;
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) { extractionId += 1; setDocument(await file.text(), file.name); }
  else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) { try { await extractPdf(file); } catch (error) { console.error(error); notify('I could not read that book. Try a readable file.'); } }
  else notify('Please choose a readable book file (PDF or TXT).');
}

document.querySelectorAll('.narrator-card').forEach((card) => card.addEventListener('click', () => {
  document.querySelectorAll('.narrator-card').forEach((item) => { item.classList.remove('is-selected'); item.setAttribute('aria-checked', 'false'); });
  card.classList.add('is-selected'); card.setAttribute('aria-checked', 'true'); state.narrator = card.dataset.narrator; localStorage.setItem('zuna-narrator', state.narrator); if (state.speaking) speakCurrent();
}));

const savedNarrator = document.querySelector(`[data-narrator="${state.narrator}"]`);
if (savedNarrator) savedNarrator.click();
document.querySelectorAll('[data-nav]').forEach((link) => link.addEventListener('click', () => document.querySelectorAll('[data-nav]').forEach((item) => item.classList.toggle('is-active', item.dataset.nav === link.dataset.nav))));

const settingsDialog = $('#settingsDialog');
const openSettings = () => settingsDialog?.showModal();
$('#settingsButton')?.addEventListener('click', openSettings);
$('#mobileSettingsButton')?.addEventListener('click', openSettings);
$('#closeSettings')?.addEventListener('click', () => settingsDialog?.close());
$('#membershipButton')?.addEventListener('click', () => notify('We will keep a place for you. Zuna+ is coming soon.'));
pdfInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
$('#clearButton').addEventListener('click', () => { stopAudio(); state.passages = []; state.index = 0; state.fileName = ''; pdfInput.value = ''; libraryPanel.hidden = true; $('#nowPlayingLabel').textContent = 'Choose a document to begin'; renderPassage(); });
playButton.addEventListener('click', togglePlayback);
$('#backButton').addEventListener('click', () => { stopAudio(); state.index = Math.max(0, state.index - 1); renderPassage(); });
$('#forwardButton').addEventListener('click', () => { stopAudio(); state.index = Math.min(Math.max(0, state.passages.length - 1), state.index + 1); renderPassage(); });
seek.addEventListener('input', () => { stopAudio(); state.index = Number(seek.value); renderPassage(); });
$('#speedSelect').value = String(state.speed);
$('#speedSelect').addEventListener('change', (event) => { state.speed = Number(event.target.value); localStorage.setItem('zuna-speed', state.speed); if (state.speaking) speakCurrent(); });
if (!fallbackSpeechAvailable()) setEngineNote('Narration is not available in this browser.');
if (state.fileName) $('#fileName').textContent = state.fileName;
window.speechSynthesis?.addEventListener('voiceschanged', () => fallbackVoice(state.narrator));
