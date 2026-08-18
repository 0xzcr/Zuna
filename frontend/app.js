import { processPagesInBatches } from './progressive-pages.mjs';

const state = {
  passages: [],
  index: 0,
  narrator: localStorage.getItem('zuna-narrator') || 'elias',
  speed: Number(localStorage.getItem('zuna-speed') || 1),
  fileName: localStorage.getItem('zuna-file-name') || '',
  speaking: false,
  generating: false,
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

let ttsWorker;
let activeRequest = 0;
let currentAudio;
let currentAudioUrl;
let localModelFailed = false;
let generationTimer;
let extractionId = 0;
let prefetchRequest = 0;
let prefetching = false;
let prefetched;

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
  ensureTtsWorker()?.postMessage({ type: 'load' });
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
  elias: { f5: 'male', pitch: .68, rate: .88, names: ['Alex', 'Daniel', 'Fred', 'Thomas', 'Arthur', 'Oliver', 'David', 'Mark', 'Male'] },
  mira: { f5: 'female', pitch: 1.18, rate: 1.04, names: ['Samantha', 'Karen', 'Victoria', 'Moira', 'Ava', 'Zoe', 'Siri', 'Female', 'Google US English'] },
};

function targetSeconds(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(12, Math.max(4, Math.ceil(words / 2.2)));
}

function setEngineNote(message) {
  engineNote.textContent = message;
}

function stopAudio() {
  window.speechSynthesis?.cancel();
  activeRequest += 1;
  prefetchRequest += 1;
  prefetching = false;
  prefetched = undefined;
  ttsWorker?.postMessage({ type: 'cancel' });
  clearTimeout(generationTimer);
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute('src');
    currentAudio.load();
    currentAudio = undefined;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = undefined;
  }
  state.speaking = false;
  state.generating = false;
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

function playAudioBlob(blob, engineMessage) {
  state.generating = false;
  setEngineNote(engineMessage);
  if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(currentAudioUrl);
  currentAudio.playbackRate = state.speed;
  currentAudio.onplay = () => { state.speaking = true; playButton.textContent = 'Ⅱ'; prefetchNext(); };
  currentAudio.onpause = () => { if (!currentAudio.ended) { state.speaking = false; playButton.textContent = '▶'; } };
  currentAudio.onerror = () => { state.speaking = false; playButton.textContent = '▶'; notify('The local narrator could not play this passage.'); };
  currentAudio.onended = () => {
    state.speaking = false;
    playButton.textContent = '▶';
    if (state.index < state.passages.length - 1) {
      state.index += 1;
      renderPassage();
      const cached = prefetched;
      if (cached && cached.index === state.index && cached.narrator === state.narrator && cached.speed === state.speed) {
        prefetched = undefined;
        playAudioBlob(cached.blob, 'Local narrator · next passage was prepared ahead of time');
      } else speakCurrent();
    } else notify('You reached the end of this document.');
  };
  currentAudio.play().catch((error) => {
    console.error('Audio playback error:', error);
    notify('Click play again to start the narrator.');
  });
}

function prefetchNext() {
  const worker = ensureTtsWorker();
  const next = state.passages[state.index + 1];
  if (!worker || !next || prefetching || (prefetched && prefetched.index === state.index + 1)) return;
  const requestId = ++prefetchRequest;
  prefetching = true;
  worker.postMessage({
    type: 'speak', requestId, prefetch: true, text: next,
    voice: narratorProfiles[state.narrator].f5,
    targetSeconds: targetSeconds(next),
  });
}

function speakWithBrowser() {
  if (!fallbackSpeechAvailable()) {
    notify('This browser does not provide local speech playback.');
    return;
  }
  state.generating = false;
  clearTimeout(generationTimer);
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(state.passages[state.index]);
  const profile = narratorProfiles[state.narrator];
  utterance.rate = state.speed * profile.rate;
  utterance.pitch = profile.pitch;
  utterance.voice = fallbackVoice(state.narrator);
  utterance.onstart = () => { state.speaking = true; playButton.textContent = 'Ⅱ'; };
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

function ensureTtsWorker() {
  if (localModelFailed || !window.Worker) return null;
  if (ttsWorker) return ttsWorker;

  ttsWorker = new Worker('./tts-worker.js', { type: 'module' });
  ttsWorker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      const percent = Number.isFinite(data.progress) ? ` ${Math.round(data.progress)}%` : '';
      const stage = data.stage ? ` · ${data.stage}` : '';
      setEngineNote(`Loading local F5 narrator${percent}${stage} · cached after download`);
      return;
    }
    if (data.type === 'ready') {
      setEngineNote(`Local F5 narrator · ${data.provider || 'WASM'} · model cached on this device`);
      return;
    }
    if (data.type === 'error') {
      if (data.prefetch) { if (data.requestId === prefetchRequest) prefetching = false; return; }
      if (data.requestId !== undefined && data.requestId !== activeRequest) return;
      clearTimeout(generationTimer);
      console.error('Local narrator error:', data.message);
      localModelFailed = true;
      state.generating = false;
      playButton.textContent = '▶';
      setEngineNote('Local narrator unavailable · using the browser voice preview');
      notify('The local narrator could not load, so Zuna switched to the browser preview.');
      if (state.passages.length) speakWithBrowser();
      return;
    }
    if (data.type !== 'audio') return;
    if (data.prefetch) {
      if (data.requestId !== prefetchRequest) return;
      prefetching = false;
      prefetched = { index: state.index + 1, narrator: state.narrator, speed: state.speed, blob: new Blob([data.wav], { type: 'audio/wav' }) };
      return;
    }
    if (data.requestId !== activeRequest) return;

    clearTimeout(generationTimer);
    playAudioBlob(new Blob([data.wav], { type: 'audio/wav' }), 'Local F5 narrator · model cached on this device');
  };
  ttsWorker.onerror = (error) => {
    console.error('Local narrator worker error:', error);
    localModelFailed = true;
    state.generating = false;
    playButton.textContent = '▶';
    setEngineNote('Local narrator unavailable · using the browser voice preview');
    clearTimeout(generationTimer);
    notify('The local narrator stopped responding, so Zuna switched to the browser preview.');
    if (state.passages.length) speakWithBrowser();
  };
  return ttsWorker;
}

function speakWithLocalModel() {
  const worker = ensureTtsWorker();
  if (!worker) {
    speakWithBrowser();
    return;
  }
  const cached = prefetched && prefetched.index === state.index && prefetched.narrator === state.narrator && prefetched.speed === state.speed ? prefetched : undefined;
  stopAudio();
  if (cached) {
    playAudioBlob(cached.blob, 'Local narrator · passage was prepared ahead of time');
    return;
  }
  state.generating = true;
  playButton.textContent = '…';
  setEngineNote('Preparing your local narrator…');
  activeRequest += 1;
  const requestId = activeRequest;
  clearTimeout(generationTimer);
  generationTimer = setTimeout(() => {
    if (!state.generating || requestId !== activeRequest) return;
    localModelFailed = true;
    state.generating = false;
    ttsWorker?.terminate();
    ttsWorker = undefined;
    setEngineNote('Local narrator timed out · using the browser voice preview');
    notify('The local narrator took too long to respond, so Zuna switched to the browser preview.');
    speakWithBrowser();
  }, 180000);
  worker.postMessage({
    type: 'speak',
    requestId,
    text: state.passages[state.index],
    voice: narratorProfiles[state.narrator].f5,
    targetSeconds: targetSeconds(state.passages[state.index]),
  });
}

function speakCurrent() {
  if (!state.passages.length) return;
  if (localModelFailed) speakWithBrowser();
  else speakWithLocalModel();
}

function togglePlayback() {
  if (!state.passages.length) { notify('Add a book to begin.'); return; }
  if (state.speaking) {
    if (currentAudio) currentAudio.pause();
    else window.speechSynthesis?.pause();
    state.speaking = false;
    playButton.textContent = '▶';
  } else if (currentAudio && !currentAudio.ended && currentAudio.currentTime > 0) {
    currentAudio.play();
    state.speaking = true;
    playButton.textContent = 'Ⅱ';
  } else if (!state.generating) speakCurrent();
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
  if (state.speaking || state.generating) speakCurrent();
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
  if (currentAudio) currentAudio.playbackRate = state.speed;
  if (state.speaking || state.generating) speakCurrent();
});
if (!window.Worker && !fallbackSpeechAvailable()) setEngineNote('Local narration is not available in this browser.');
if (state.fileName) $('#fileName').textContent = state.fileName;
window.speechSynthesis?.addEventListener('voiceschanged', () => fallbackVoice(state.narrator));
