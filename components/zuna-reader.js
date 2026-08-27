'use client';

import { useEffect } from 'react';

function Wordmark({ mobile = false }) {
  return <a className={mobile ? 'mobile-brand' : 'wordmark'} href="#home" aria-label="Zuna home"><span className="wordmark-mark">z</span><span>una</span></a>;
}

function Navigation() {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <Wordmark />
      <p className="sidebar-kicker">Your private<br />listening room</p>
      <nav className="nav-links" aria-label="Sections">
        <a className="nav-link is-active" href="#home" data-nav="home"><span className="nav-icon">⌂</span>Home</a>
        <a className="nav-link" href="#library" data-nav="library"><span className="nav-icon">▱</span>Library</a>
        <a className="nav-link" href="#narrators" data-nav="narrators"><span className="nav-icon">◌</span>Narrators</a>
      </nav>
      <div className="sidebar-bottom">
        <a className="zuna-plus" href="#membership"><span className="plus-mark">+</span><span><strong>Zuna+</strong><br /><small>More ways to listen</small></span><span className="arrow">↗</span></a>
        <div className="privacy-note"><span className="status-dot" /><span><strong>Private by design</strong><br />Your books stay on this device.</span></div>
        <button className="nav-link nav-button" id="settingsButton" type="button"><span className="nav-icon">⌘</span>Settings</button>
      </div>
    </aside>
  );
}

function Hero() {
  return (
    <>
      <section className="hero" aria-labelledby="welcome-title">
        <div className="hero-copy"><p className="eyebrow">A quieter way to read</p><h1 id="welcome-title">Your books,<br />with a <em>voice.</em></h1><p className="hero-description">Zuna turns the books you already own into listening sessions that feel close, calm, and entirely yours.</p><div className="hero-actions"><a className="primary-button" href="#library">Bring in a book <span>↗</span></a><a className="text-link" href="#about">Why Zuna <span>↓</span></a></div></div>
        <div className="hero-orbit" aria-hidden="true"><span className="orbit-ring orbit-ring-one" /><span className="orbit-ring orbit-ring-two" /><span className="orbit-dot" /><span className="orbit-label">read<br />listen<br />return</span></div>
      </section>
      <section className="continue-card" aria-labelledby="continue-title">
        <div className="continue-art" aria-hidden="true"><img src="/assets/zuna-frame-4k.webp" alt="" width="768" height="1024" /><span className="art-wash" /><span className="art-caption">a voice<br />worth<br />returning to</span><span className="art-index">01</span></div>
        <div className="continue-copy"><p className="eyebrow">Your listening room</p><h2 id="continue-title">Start with something<br /><em>worth finishing.</em></h2><p>Bring a book you already love. Zuna keeps it close, finds a natural place to begin, and lets you settle in.</p><a className="quiet-link" href="#library">Open your library <span>↗</span></a></div>
        <div className="continue-mark" aria-hidden="true">✳</div>
      </section>
      <section className="promise-strip" id="about" aria-label="Zuna promises"><div><span className="strip-number">01</span><strong>Local first</strong><span>Books stay on your device.</span></div><div><span className="strip-number">02</span><strong>Start sooner</strong><span>Listen while the rest loads.</span></div><div><span className="strip-number">03</span><strong>Make it yours</strong><span>Choose the voice that fits.</span></div></section>
    </>
  );
}

function ReaderSections() {
  return (
    <>
      <section className="library-section" id="library" aria-labelledby="library-title">
        <div className="section-heading"><div><p className="eyebrow">01 / Your library</p><h2 id="library-title">A quiet shelf for<br /><em>the good ones.</em></h2></div><span className="section-note">local only · no account needed</span></div>
        <label className="drop-zone" id="dropZone" htmlFor="pdfInput"><input id="pdfInput" type="file" accept="application/pdf,application/epub+zip,.epub,.txt,text/plain" /><span className="drop-symbol">＋</span><span className="drop-title">Bring in a book</span><span className="drop-subtitle">Drop a PDF, EPUB, or TXT here · it never leaves your device</span><span className="drop-hint">or choose a file</span></label>
        <div className="file-status" id="libraryPanel" hidden><span className="file-icon">▱</span><div><span className="mini-label">READY TO LISTEN</span><h3 id="fileName">Your document</h3><p id="fileMeta">0 chapters · local only</p></div><button className="text-button" id="clearButton" type="button">Change book <span>↗</span></button></div>
      </section>
      <section className="narrator-section" id="narrators" aria-labelledby="voice-title">
        <div className="section-heading"><div><p className="eyebrow">02 / The room tone</p><h2 id="voice-title">Choose a narrator.</h2></div><span className="section-note">Kokoro · all voices free</span></div>
        <div className="voice-picker"><label className="voice-select-label" htmlFor="voiceSelect"><span className="mini-label">VOICE</span><span className="voice-select-shell"><select id="voiceSelect" aria-label="Choose a Kokoro narrator" disabled defaultValue=""><option value="">Connecting to local runtime…</option></select><span className="select-chevron" aria-hidden="true">⌄</span></span></label><span className="voice-count" id="voiceCount">Connecting to local runtime…</span></div>
      </section>
      <section className="membership-card" id="membership" aria-labelledby="membership-title"><div><p className="eyebrow">A little more room</p><h2 id="membership-title">Listen in your<br /><em>own rhythm.</em></h2></div><div className="membership-copy"><p>Zuna+ will bring gentle reading stats and more room for the books you want to hear. Every local Kokoro voice stays free.</p><button className="outline-button" id="membershipButton" type="button">Keep me posted <span>↗</span></button></div></section>
    </>
  );
}

function Player() {
  return (
    <>
      <section className="player" id="player" aria-label="Zuna audio player">
        <div className="player-topline"><span id="nowPlayingLabel">Choose a document to begin</span><span id="progressLabel">0 / 0</span></div>
        <div className="chapter-picker"><label className="chapter-select-label" htmlFor="chapterSelect"><span className="mini-label">CHAPTER</span><span className="chapter-select-shell"><select id="chapterSelect" aria-label="Choose a chapter" disabled defaultValue=""><option value="">Choose a book first…</option></select><span className="select-chevron" aria-hidden="true">⌄</span></span></label><span className="chapter-status" id="chapterStatus" role="status" aria-live="polite">Import a book to prepare its chapters.</span></div>
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
      <nav className="mobile-nav" aria-label="Mobile navigation"><a className="is-active" href="#home" data-nav="home"><span>⌂</span>Home</a><a href="#library" data-nav="library"><span>▱</span>Library</a><a href="#narrators" data-nav="narrators"><span>◌</span>Voices</a><button id="mobileSettingsButton" type="button"><span>⌘</span>Settings</button></nav>
      <dialog className="settings-dialog" id="settingsDialog" aria-labelledby="settingsTitle"><div className="dialog-head"><div><p className="eyebrow">Your preferences</p><h2 id="settingsTitle">Settings</h2></div><button className="dialog-close" id="closeSettings" type="button" aria-label="Close settings">×</button></div><div className="settings-row"><span><strong>Local storage</strong><small>Extracted books, progress, and generated audio stay in this browser.</small></span><span className="settings-status">ON</span></div><div className="settings-row"><span><strong>Free narration</strong><small>Kokoro local runtime · all voices unlocked.</small></span><span className="settings-status">KOKORO</span></div></dialog>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
