import { processPagesInBatches } from './progressive-pages.mjs';

const state = {
  passages: [],
  index: 0,
  narrator: localStorage.getItem('zuna-narrator') || 'elias',
  speed: Number(localStorage.getItem('zuna-speed') || 1),
  fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false,
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

function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('is-visible'), 3400);
}

function splitIntoPassages(text) {
  // ponytail: deliberately simple sentence grouping; replace with a language-aware segmenter if PDF tests expose edge cases.
  return text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter((item) => item.length > 2) || [];
}

function cleanText(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const counts = new Map();
  lines.forEach((line) => counts.set(line, (counts.get(line) || 0) + 1));
  return lines.filter((line) => {
    if (/^\d{1,4}$/.test(line)) return false;
    if (line.length < 90 && (counts.get(line) || 0) > 1) return false;
    return true;
  }).join(' ');
}

function setDocument(text, name) {
  state.passages = splitIntoPassages(cleanText(text));
  state.index = Number(localStorage.getItem(`zuna-progress:${name}`) || 0);
  state.index = Math.min(state.index, Math.max(0, state.passages.length - 1));
  state.fileName = name;
  localStorage.setItem('zuna-file-name', name);
  $('#fileName').textContent = name;
  $('#fileMeta').textContent = `${state.passages.length} passages · local only`;
  libraryPanel.hidden = false;
  seek.max = Math.max(0, state.passages.length - 1);
  seek.value = state.index;
  renderPassage();
  document.querySelector('.voice-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  notify(`${state.passages.length} passages ready to listen.`);
}

function appendDocument(text, page, pageCount) {
  state.passages.push(...splitIntoPassages(cleanText(text)));
  $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${page} / ${pageCount} · local only`;
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

function setEngineNote(message) {
  engineNote.textContent = message;
}

function stopAudio() {
  window.speechSynthesis?.cancel();
  state.speaking = false;
  playButton.textContent = '▶';
}

function fallbackSpeechAvailable() {
  return 'speechSynthesis' in window;
}

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
  utterance.onstart = () => { state.speaking = true; playButton.textContent = 'Ⅱ'; setEngineNote('Browser speech narration · processed locally'); };
  utterance.onend = () => {
    state.speaking = false;
    playButton.textContent = '▶';
    if (state.index < state.passages.length - 1) {
      state.index += 1;
      renderPassage();
      speakCurrent();
    } else notify('You reached the end of this document.');
  };
  utterance.onerror = () => { state.speaking = false; playButton.textContent = '▶'; notify('The browser could not start narration.'); };
  window.speechSynthesis.speak(utterance);
}

function speakCurrent() {
  if (state.passages.length) speakWithBrowser();
}

function togglePlayback() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  if (state.speaking) {
    window.speechSynthesis.pause();
    state.speaking = false;
    playButton.textContent = '▶';
  } else if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
    state.speaking = true;
    playButton.textContent = 'Ⅱ';
  } else speakCurrent();
}

async function extractPdf(file) {
  const currentExtraction = ++extractionId;
  notify('Reading your book locally…');
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  let firstBatch = true;
  await processPagesInBatches(document.numPages, async (pageNumber) => {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str).join(' ');
  }, (pages, pageNumber, pageCount) => {
    if (currentExtraction !== extractionId) return false;
    if (firstBatch) {
      firstBatch = false;
      setDocument(pages.join('\n'), file.name);
    } else appendDocument(pages.join('\n'), pageNumber, pageCount);
    $('#fileMeta').textContent = `${state.passages.length} passages · reading page ${pageNumber} / ${pageCount} · local only`;
    if (pageNumber === pageCount) notify(`${state.passages.length} passages ready to listen.`);
    return true;
  });
}

async function handleFile(file) {
  if (!file) return;
  if (file.type === 'text/plain' || file.name.endsWith('.txt')) { extractionId += 1; setDocument(await file.text(), file.name); }
  else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try { await extractPdf(file); } catch (error) { console.error(error); notify('I could not read that book. Try a readable file.'); }
  } else notify('Please choose a readable book file (PDF or TXT).');
}

document.querySelectorAll('.narrator-card').forEach((card) => card.addEventListener('click', () => {
  document.querySelectorAll('.narrator-card').forEach((item) => { item.classList.remove('is-selected'); item.setAttribute('aria-checked', 'false'); });
  card.classList.add('is-selected'); card.setAttribute('aria-checked', 'true');
  state.narrator = card.dataset.narrator;
  localStorage.setItem('zuna-narrator', state.narrator);
  if (state.speaking) speakCurrent();
}));

const savedNarrator = document.querySelector(`[data-narrator="${state.narrator}"]`);
if (savedNarrator) savedNarrator.click();

pdfInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
$('#clearButton').addEventListener('click', () => { stopAudio(); state.passages = []; state.index = 0; pdfInput.value = ''; libraryPanel.hidden = true; renderPassage(); });
playButton.addEventListener('click', togglePlayback);
$('#backButton').addEventListener('click', () => { stopAudio(); state.index = Math.max(0, state.index - 1); renderPassage(); });
$('#forwardButton').addEventListener('click', () => { stopAudio(); state.index = Math.min(Math.max(0, state.passages.length - 1), state.index + 1); renderPassage(); });
seek.addEventListener('input', () => { stopAudio(); state.index = Number(seek.value); renderPassage(); });
$('#speedSelect').value = String(state.speed);
$('#speedSelect').addEventListener('change', (event) => {
  state.speed = Number(event.target.value);
  localStorage.setItem('zuna-speed', state.speed);
  if (state.speaking) speakCurrent();
});
if (!fallbackSpeechAvailable()) setEngineNote('Narration is not available in this browser.');
if (state.fileName) $('#fileName').textContent = state.fileName;
window.speechSynthesis?.addEventListener('voiceschanged', () => fallbackVoice(state.narrator));
