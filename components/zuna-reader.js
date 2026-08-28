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
        <span className="local-state"><span className="status-dot" />local runtime</span>
        <button className="round-control theme-toggle" id="themeToggle" type="button" aria-label="Switch to dark mode" aria-pressed="false"><span id="themeIcon">☼</span></button>
        <button className="settings-button" id="settingsButton" type="button">Settings</button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="home" aria-labelledby="welcome-title">
      <BrandRow />
      <div className="hero-stage">
        <p className="hero-kicker hero-enter">Your private audiobook studio</p>
        <h1 id="welcome-title" className="hero-enter">Where your<br /><span>books</span> come alive</h1>
        <a className="hero-button hero-enter" href="#library">Start listening <span>↓</span></a>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <span className="art-orb"><img src="/assets/zuna-abstract-liquid.webp" alt="" width="1200" height="1800" fetchPriority="high" /></span>
          <span className="floating-disc disc-one" />
          <span className="floating-disc disc-two" />
        </div>
      </div>
      <p className="hero-foot">PDF · EPUB · TXT <span>Books stay on this device</span></p>
    </section>
  );
}

function Marquee() {
  const words = 'IMPORT · LISTEN · RETURN · 54 FREE VOICES · PRIVATE BY DESIGN · ';
  return <div className="marquee" aria-hidden="true"><div className="marquee-track"><span>{words}</span><span>{words}</span></div></div>;
}

function Library() {
  return (
    <section className="library-section scroll-panel" id="library" aria-labelledby="library-title">
      <div className="panel-intro" data-reveal><p className="eyebrow">01 / Bring your library</p><h2 id="library-title">Listen to<br />anything.</h2><p>Drop in a book you already own. Zuna extracts it locally, finds its chapters, and remembers where you stopped.</p></div>
      <div className="library-stage" data-reveal>
        <div className="library-art" aria-hidden="true"><img src="/assets/zuna-abstract-blue-brown.webp" alt="" width="1200" height="1792" loading="lazy" /><span className="art-stamp">YOUR<br />BOOKS</span></div>
        <div className="library-tools">
          <div className="saved-shelf" id="savedShelf" hidden><div className="saved-shelf-head"><div><span className="mini-label">SAVED ON THIS DEVICE</span><p>Continue without importing again.</p></div><span id="savedBookCount">0 books</span></div><div className="saved-book-rail" id="savedBookRail" role="group" aria-label="Saved books" /></div>
          <label className="drop-zone" id="dropZone" htmlFor="pdfInput"><input id="pdfInput" type="file" accept="application/pdf,application/epub+zip,.epub,.txt,text/plain" /><span className="drop-symbol">＋</span><span className="drop-copy"><strong>Choose a book</strong><small>PDF, EPUB, or TXT · processed locally</small></span><span className="drop-arrow">↗</span></label>
          <div className="file-status" id="libraryPanel" hidden><span className="file-icon">▱</span><div><span className="mini-label">READY TO LISTEN</span><h3 id="fileName">Your document</h3><p id="fileMeta">0 chapters · local only</p></div><button className="text-button" id="clearButton" type="button">Change book <span>↗</span></button></div>
        </div>
      </div>
    </section>
  );
}

function Narrators() {
  return (
    <section className="narrator-section scroll-panel" id="narrators" aria-labelledby="voice-title">
      <div className="voice-art" data-reveal><img src="/assets/zuna-abstract-mineral.webp" alt="Abstract mineral texture in orange and blue" width="1200" height="1805" loading="lazy" /><span className="voice-number">54<small>voices</small></span></div>
      <div className="voice-copy" data-reveal><p className="eyebrow">02 / Find your sound</p><h2 id="voice-title">Every story<br />needs a voice.</h2><p>Choose from every Kokoro narrator. No premium tier, no locked voices, no cloud hand-off.</p><div className="voice-picker"><label className="voice-select-label" htmlFor="voiceSelect"><span className="mini-label">CHOOSE YOUR NARRATOR</span><span className="voice-select-shell"><select id="voiceSelect" aria-label="Choose a Kokoro narrator" disabled defaultValue=""><option value="">Connecting to local runtime…</option></select><span className="select-chevron" aria-hidden="true">↓</span></span></label><span className="voice-count" id="voiceCount">Connecting to local runtime…</span></div></div>
    </section>
  );
}

function PrivacyStory() {
  return (
    <section className="privacy-section scroll-panel" aria-labelledby="privacy-title">
      <div data-reveal><p className="eyebrow">03 / Maximum privacy</p><h2 id="privacy-title">Your library<br />stays yours.</h2></div>
      <div className="privacy-points" data-reveal><article><strong>0</strong><span>book uploads</span></article><article><strong>54</strong><span>free local voices</span></article><article><strong>∞</strong><span>chapters to finish</span></article></div>
      <p className="privacy-note" data-reveal>Extraction, progress, and generated audio stay in this browser. Zuna talks only to the Kokoro runtime running on your computer.</p>
    </section>
  );
}

function Player() {
  return (
    <section className="listen-section scroll-panel" aria-labelledby="listen-title">
      <div className="listen-intro" data-reveal><p className="eyebrow">04 / Press play</p><h2 id="listen-title">Pick a chapter.<br />Keep moving.</h2></div>
      <div className="player" id="player" aria-label="Zuna audio player" data-reveal>
        <div className="player-topline"><span className="player-kicker">NOW PLAYING</span><span id="progressLabel">0 / 0</span></div><div className="player-title" id="nowPlayingLabel">Choose a document to begin</div>
        <div className="chapter-picker"><div className="chapter-picker-head"><span className="mini-label">CHAPTERS</span><span className="chapter-status" id="chapterStatus" role="status" aria-live="polite">Import a book to prepare its chapters.</span></div><div className="chapter-slider"><button className="chapter-slide-button" id="chapterPrevious" type="button" aria-label="Show previous chapters">←</button><div className="chapter-rail" id="chapterRail" role="group" aria-label="Choose a chapter"><span className="chapter-empty">Choose a book first…</span></div><button className="chapter-slide-button" id="chapterNext" type="button" aria-label="Show next chapters">→</button></div></div>
        <div className="passage" id="passage" aria-live="polite"><span className="passage-placeholder">Your current passage will appear here.</span></div>
        <div className="player-controls"><button className="play-button" id="playButton" type="button" aria-label="Play">▶</button><button className="small-control" id="backButton" type="button" aria-label="Previous passage">↶</button><button className="small-control" id="forwardButton" type="button" aria-label="Next passage">↷</button><input className="seek" id="seek" type="range" min="0" max="0" defaultValue="0" aria-label="Passage position" /><select className="speed-select" id="speedSelect" aria-label="Playback speed" defaultValue="1"><option value="0.85">0.85×</option><option value="1">1×</option><option value="1.15">1.15×</option><option value="1.3">1.3×</option></select></div>
      </div>
      <p className="engine-note" id="engineNote">Kokoro local runtime · checking connection…</p>
    </section>
  );
}

function Footer() {
  return <footer className="footer"><Wordmark /><p>A private reading companion<br />for the things worth finishing.</p><a href="#home">Back to top ↑</a></footer>;
}

export default function ZunaReader() {
  useEffect(() => {
    import('../frontend/app.js');
    const reveals = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) { reveals.forEach((element) => element.classList.add('is-visible')); return undefined; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.14 });
    reveals.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <main><Hero /><Marquee /><Library /><Narrators /><PrivacyStory /><Player /></main>
      <Footer />
      <dialog className="settings-dialog" id="settingsDialog" aria-labelledby="settingsTitle"><div className="dialog-head"><div><p className="eyebrow">Your preferences</p><h2 id="settingsTitle">Settings</h2></div><button className="dialog-close" id="closeSettings" type="button" aria-label="Close settings">×</button></div><div className="settings-row"><span><strong>Local storage</strong><small>Extracted books, progress, and generated audio stay in this browser.</small></span><button className="retry-button" id="clearCacheButton" type="button">Clear cache</button></div><div className="settings-row"><span><strong>Free narration</strong><small>Kokoro local runtime · all voices unlocked.</small></span><span className="settings-status">KOKORO</span></div></dialog>
      <div className="toast" id="toast" role="status" aria-live="polite" />
    </>
  );
}
