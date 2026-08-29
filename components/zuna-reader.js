'use client';

import { useEffect } from 'react';

function Wordmark() {
  return <a className="wordmark" href="#home" aria-label="Zuna home">zuna</a>;
}

function BrandRow() {
  return (
    <header className="brand-row">
      <Wordmark />
      <div className="brand-actions">
        <span className="local-state"><span className="status-dot" />on-device AI</span>
        <button className="round-control theme-toggle" id="themeToggle" type="button" aria-label="Switch to dark mode" aria-pressed="false"><span id="themeIcon">☼</span></button>
        <button className="settings-button" id="settingsButton" type="button" aria-label="Open settings">Settings</button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero page-panel" id="home" aria-labelledby="welcome-title">
      <div className="hero-stage">
        <p className="hero-kicker hero-enter">Your private audiobook studio</p>
        <h1 id="welcome-title" className="hero-enter">Where your<br /><span>books</span> come alive</h1>
        <a className="hero-button hero-enter" href="#reader">Open your reader <span>↓</span></a>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="art-orb"><img src="/assets/zuna-abstract-liquid.webp" alt="" width="1200" height="1800" fetchPriority="high" /></span>
          <span className="floating-disc disc-one" />
          <span className="floating-disc disc-two" />
        </div>
      </div>
      <div className="hero-foot">
        <span>PDF · EPUB · TXT</span>
        <span className="scroll-cue">One scroll to your listening room <b>↓</b></span>
        <span>Books stay on this device</span>
      </div>
    </section>
  );
}

function SourcePanel() {
  return (
    <section className="workspace-panel source-panel" aria-labelledby="source-title">
      <div className="panel-heading">
        <div><span className="mini-label">YOUR LIBRARY</span><h3 id="source-title">Bring a book.</h3></div>
        <span className="panel-index">01</span>
      </div>

      <div className="saved-shelf" id="savedShelf" hidden>
        <div className="saved-shelf-head">
          <div><span className="mini-label">SAVED ON THIS DEVICE</span><p>Continue instantly.</p></div>
          <span id="savedBookCount">0 books</span>
        </div>
        <div className="saved-book-rail" id="savedBookRail" role="group" aria-label="Saved books" />
      </div>

      <label className="drop-zone" id="dropZone" htmlFor="pdfInput">
        <input id="pdfInput" type="file" accept="application/pdf,application/epub+zip,.epub,.txt,text/plain" />
        <span className="drop-symbol">＋</span>
        <span className="drop-copy"><strong>Choose a book</strong><small>PDF, EPUB, or TXT · local only</small></span>
        <span className="drop-arrow">↗</span>
      </label>

      <div className="file-status" id="libraryPanel" hidden>
        <span className="file-icon">▱</span>
        <div><span className="mini-label">READY TO LISTEN</span><h3 id="fileName">Your document</h3><p id="fileMeta">0 chapters · local only</p></div>
        <button className="text-button" id="clearButton" type="button">Change <span>↗</span></button>
      </div>
    </section>
  );
}

function VoicePanel() {
  return (
    <section className="workspace-panel voice-panel" aria-labelledby="voice-title">
      <div className="panel-heading">
        <div><span className="mini-label">NARRATOR</span><h3 id="voice-title">Choose a voice.</h3></div>
        <span className="voice-total">28</span>
      </div>
      <div className="voice-picker">
        <label className="voice-select-label" htmlFor="voiceSelect">
          <span className="voice-select-shell">
            <select id="voiceSelect" aria-label="Choose a Kokoro narrator" disabled defaultValue=""><option value="">Loading Kokoro on this device…</option></select>
            <span className="select-chevron" aria-hidden="true">↓</span>
          </span>
        </label>
        <span className="voice-count" id="voiceCount">Model loading…</span>
      </div>
      <div className="privacy-line"><span>0 uploads</span><span>28 free voices</span><span>on-device generation</span></div>
    </section>
  );
}

function PlayerPanel() {
  return (
    <section className="player workspace-panel" id="player" aria-label="Zuna audio player">
      <div className="player-topline"><span className="player-kicker">NOW PLAYING</span><span id="progressLabel">0 / 0</span></div>
      <div className="player-title" id="nowPlayingLabel">Choose a document to begin</div>

      <div className="chapter-picker">
        <div className="chapter-picker-head"><span className="mini-label">CHAPTERS</span><span className="chapter-status" id="chapterStatus" role="status" aria-live="polite">Import a book to prepare its chapters.</span></div>
        <div className="chapter-slider">
          <button className="chapter-slide-button" id="chapterPrevious" type="button" aria-label="Show previous chapters">←</button>
          <div className="chapter-rail" id="chapterRail" role="group" aria-label="Choose a chapter"><span className="chapter-empty">Choose a book first…</span></div>
          <button className="chapter-slide-button" id="chapterNext" type="button" aria-label="Show next chapters">→</button>
        </div>
      </div>

      <div className="passage" id="passage" aria-live="polite"><span className="passage-placeholder">Your current passage will appear here.</span></div>

      <div className="player-controls">
        <button className="play-button" id="playButton" type="button" aria-label="Play">▶</button>
        <button className="small-control" id="backButton" type="button" aria-label="Previous passage">↶</button>
        <button className="small-control" id="forwardButton" type="button" aria-label="Next passage">↷</button>
        <input className="seek" id="seek" type="range" min="0" max="0" defaultValue="0" aria-label="Passage position" />
        <select className="speed-select" id="speedSelect" aria-label="Playback speed" defaultValue="1"><option value="0.85">0.85×</option><option value="1">1×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select>
      </div>
    </section>
  );
}

function ReaderPage() {
  return (
    <section className="reader-page page-panel" id="reader" aria-labelledby="reader-title">
      <div className="reader-art" aria-hidden="true"><img src="/assets/zuna-abstract-blue-brown.webp" alt="" width="1200" height="1792" loading="lazy" /></div>
      <div className="reader-shell">
        <header className="reader-heading">
          <div><p className="eyebrow">02 / Your listening room</p><h2 id="reader-title">The whole reader.</h2></div>
          <div className="reader-status">
            <div className="model-loading" id="modelLoading">
              <div><strong>Loading Kokoro</strong><output id="modelProgressLabel" htmlFor="modelProgress">0%</output></div>
              <progress id="modelProgress" max="100" value="0" aria-label="Kokoro model loading progress" />
            </div>
          </div>
        </header>
        <div className="reader-workspace">
          <div className="reader-sidebar"><SourcePanel /><VoicePanel /></div>
          <PlayerPanel />
        </div>
      </div>
    </section>
  );
}

function SettingsDialog() {
  return (
    <dialog className="settings-dialog" id="settingsDialog" aria-labelledby="settingsTitle">
      <div className="dialog-head"><div><p className="eyebrow">Your preferences</p><h2 id="settingsTitle">Settings</h2></div><button className="dialog-close" id="closeSettings" type="button" aria-label="Close settings">×</button></div>
      <div className="settings-row"><span><strong>Local storage</strong><small>Extracted books, progress, and generated audio stay in this browser.</small></span><button className="retry-button" id="clearCacheButton" type="button">Clear cache</button></div>
      <div className="settings-row"><span><strong>Free narration</strong><small>Kokoro runs on-device · all supported voices unlocked.</small></span><span className="settings-status">KOKORO</span></div>
    </dialog>
  );
}

export default function ZunaReader() {
  useEffect(() => { import('../frontend/app.js'); }, []);

  return (
    <>
      <BrandRow />
      <main><Hero /><ReaderPage /></main>
      <SettingsDialog />
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
