'use client';

import { useEffect } from 'react';
import { MovingBorder, Spotlight } from './aceternity';

function Wordmark({ mobile = false }) {
  return <a className={mobile ? 'mobile-brand' : 'wordmark'} href="#home" aria-label="Zuna home"><span className="wordmark-mark"><span>z</span></span><span>una</span></a>;
}

function Navigation() {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Wordmark />
      <p className="sidebar-kicker">Your private<br />listening room</p>
      <nav className="nav-links" aria-label="Sections">
        <a className="nav-link is-active" href="#home" data-nav="home"><span className="nav-icon">01</span>Overview</a>
        <a className="nav-link" href="#library" data-nav="library"><span className="nav-icon">02</span>Library</a>
        <a className="nav-link" href="#narrators" data-nav="narrators"><span className="nav-icon">03</span>Voices</a>
      </nav>
      <div className="sidebar-bottom">
        <div className="privacy-note"><span className="status-dot" /><span><strong>Local by design</strong><br />Your books stay on this device.</span></div>
        <button className="nav-link nav-button" id="settingsButton" type="button"><span className="nav-icon">⌘</span>Settings</button>
      </div>
    </aside>
  );
}

function Hero() {
  return (
    <section className="hero" aria-labelledby="welcome-title">
      <Spotlight />
      <div className="hero-copy"><div className="hero-kicker"><span className="status-dot" /> LOCAL AUDIOBOOK STUDIO</div><h1 id="welcome-title">A better way<br />to <em>listen.</em></h1><p className="hero-description">Bring the books you already own into a private listening room. Everything runs on this device, from first page to final chapter.</p><div className="hero-actions"><a className="primary-button" href="#library">Choose a book <span>↗</span></a><a className="text-link" href="#narrators">Find your voice <span>↓</span></a></div></div>
      <MovingBorder className="workflow-card"><div className="workflow-art"><img src="/assets/zuna-abstract-liquid.webp" alt="Abstract blue and orange fluid texture" width="1200" height="1800" fetchPriority="high" /></div><div className="workflow-copy"><span className="mini-label">THE ZUNA FLOW</span><strong>Read. Listen.<br />Return.</strong><span className="workflow-line">01 / local to you</span></div></MovingBorder>
    </section>
  );
}

function ReaderSections() {
  return (
    <>
      <section className="library-section" id="library" aria-labelledby="library-title">
        <div className="section-heading"><div><p className="eyebrow">02 / Your library</p><h2 id="library-title">Keep the books<br /><em>you return to.</em></h2></div><span className="section-note">private by default</span></div>
        <div className="saved-shelf" id="savedShelf" hidden><div className="saved-shelf-head"><div><span className="mini-label">SAVED ON THIS DEVICE</span><p>Continue a book without importing it again.</p></div><span id="savedBookCount">0 books</span></div><div className="saved-book-rail" id="savedBookRail" role="group" aria-label="Saved books" /></div>
        <label className="drop-zone" id="dropZone" htmlFor="pdfInput"><input id="pdfInput" type="file" accept="application/pdf,application/epub+zip,.epub,.txt,text/plain" /><span className="drop-art"><img src="/assets/zuna-abstract-blue-brown.webp" alt="" width="1200" height="1792" loading="lazy" /></span><span className="drop-content"><span className="drop-symbol">＋</span><span className="drop-title">Bring in a book</span><span className="drop-subtitle">PDF, EPUB, or TXT · processed on this device</span><span className="drop-hint">or choose a file</span></span></label>
        <div className="file-status" id="libraryPanel" hidden><span className="file-icon">▱</span><div><span className="mini-label">READY TO LISTEN</span><h3 id="fileName">Your document</h3><p id="fileMeta">0 chapters · local only</p></div><button className="text-button" id="clearButton" type="button">Change book <span>↗</span></button></div>
      </section>
      <section className="narrator-section" id="narrators" aria-labelledby="voice-title">
        <div className="section-heading"><div><p className="eyebrow">03 / The room tone</p><h2 id="voice-title">Find a voice<br /><em>that fits.</em></h2></div><span className="section-note">Kokoro · every voice free</span></div>
        <div className="voice-layout"><div className="voice-picker"><label className="voice-select-label" htmlFor="voiceSelect"><span className="mini-label">NARRATOR</span><span className="voice-select-shell"><select id="voiceSelect" aria-label="Choose a Kokoro narrator" disabled defaultValue=""><option value="">Connecting to local runtime…</option></select><span className="select-chevron" aria-hidden="true">⌄</span></span></label><span className="voice-count" id="voiceCount">Connecting to local runtime…</span></div><div className="voice-art"><img src="/assets/zuna-abstract-mineral.webp" alt="Abstract mineral texture in orange and blue" width="1200" height="1805" loading="lazy" /><span>54<br /><small>free voices</small></span></div></div>
      </section>
    </>
  );
}

function Player() {
  return (
    <>
      <section className="player" id="player" aria-label="Zuna audio player">
        <div className="player-topline"><span className="player-kicker">NOW PLAYING</span><span id="progressLabel">0 / 0</span></div><div className="player-title" id="nowPlayingLabel">Choose a document to begin</div>
        <div className="chapter-picker"><div className="chapter-picker-head"><span className="mini-label">CHAPTERS</span><span className="chapter-status" id="chapterStatus" role="status" aria-live="polite">Import a book to prepare its chapters.</span></div><div className="chapter-slider"><button className="chapter-slide-button" id="chapterPrevious" type="button" aria-label="Show previous chapters">←</button><div className="chapter-rail" id="chapterRail" role="group" aria-label="Choose a chapter"><span className="chapter-empty">Choose a book first…</span></div><button className="chapter-slide-button" id="chapterNext" type="button" aria-label="Show next chapters">→</button></div></div>
        <div className="passage" id="passage" aria-live="polite"><span className="passage-placeholder">Your current passage will appear here.</span></div>
        <div className="player-controls"><button className="play-button" id="playButton" type="button" aria-label="Play">▶</button><button className="small-control" id="backButton" type="button" aria-label="Previous passage">↶</button><button className="small-control" id="forwardButton" type="button" aria-label="Next passage">↷</button><input className="seek" id="seek" type="range" min="0" max="0" defaultValue="0" aria-label="Passage position" /><select className="speed-select" id="speedSelect" aria-label="Playback speed" defaultValue="1"><option value="0.85">0.85×</option><option value="1">1×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select></div>
      </section>
      <p className="engine-note" id="engineNote">Kokoro local runtime · checking connection…</p>
    </>
  );
}

export default function ZunaReader() {
  useEffect(() => { import('../frontend/app.js'); }, []);
  return (
    <>
      <div className="app-frame">
        <Navigation />
        <main className="main-content" id="home">
          <header className="topbar"><Wordmark mobile /><div className="topbar-meta"><span className="saved-state"><span className="status-dot" />saved locally</span><button className="theme-toggle" id="themeToggle" type="button" aria-label="Switch to dark mode" aria-pressed="false"><span id="themeIcon">☼</span></button></div></header>
          <div className="content-wrap"><Hero /><ReaderSections /><Player /><footer className="footer"><span>zuna / a private reading companion</span><span>Built for the things worth finishing.</span></footer></div>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation"><a className="is-active" href="#home" data-nav="home"><span>01</span>Overview</a><a href="#library" data-nav="library"><span>02</span>Library</a><a href="#narrators" data-nav="narrators"><span>03</span>Voices</a><button id="mobileSettingsButton" type="button"><span>⌘</span>Settings</button></nav>
      <dialog className="settings-dialog" id="settingsDialog" aria-labelledby="settingsTitle"><div className="dialog-head"><div><p className="eyebrow">Your preferences</p><h2 id="settingsTitle">Settings</h2></div><button className="dialog-close" id="closeSettings" type="button" aria-label="Close settings">×</button></div><div className="settings-row"><span><strong>Local storage</strong><small>Extracted books, progress, and generated audio stay in this browser.</small></span><button className="retry-button" id="clearCacheButton" type="button">Clear cache</button></div><div className="settings-row"><span><strong>Free narration</strong><small>Kokoro local runtime · all voices unlocked.</small></span><span className="settings-status">KOKORO</span></div></dialog>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
