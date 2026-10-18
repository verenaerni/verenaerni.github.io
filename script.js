(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const video = document.getElementById('portrait-film');
  const control = document.getElementById('video-control');
  const status = document.getElementById('video-status');
  const filmFallback = document.getElementById('film-fallback');
  let explicitlyPaused = false;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  function updateFilm() {
    const playing = !video.paused;
    control.querySelector('.control-symbol').textContent = playing ? 'Ⅱ' : '▷';
    control.querySelector('.control-label').textContent = playing ? 'Pause' : 'Film ansehen';
    control.setAttribute('aria-label', playing ? 'Porträtfilm pausieren' : 'Porträtfilm abspielen');
    control.setAttribute('aria-pressed', String(!playing));
  }
  function startFilm() {
    if (explicitlyPaused || document.hidden || !video.paused) return;
    video.muted = true;
    video.play().catch(() => updateFilm());
  }
  video.addEventListener('playing', () => { video.controls = false; filmFallback.hidden = true; updateFilm(); });
  video.addEventListener('pause', updateFilm);
  video.addEventListener('canplay', startFilm);
  video.addEventListener('error', () => { status.textContent = 'Der Film ist momentan nicht verfügbar.'; filmFallback.hidden = false; updateFilm(); });
  control.addEventListener('click', () => {
    if (video.paused) {
      explicitlyPaused = false;
      video.muted = true;
      // Call play directly inside the tap handler. Retry loading only after a real media error.
      if (video.error) video.load();
      video.play().catch(() => { video.controls = true; filmFallback.hidden = false; updateFilm(); });
    }
    else { explicitlyPaused = true; video.pause(); }
  });
  addEventListener('pageshow', startFilm);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startFilm(); });
  // First interaction is a fallback for browsers that restrict even muted autoplay.
  function resumeFromGesture(event) {
    if (!control.contains(event.target)) startFilm();
  }
  // iOS recognises touchend/click as a media gesture; pointerdown alone is insufficient.
  document.addEventListener('touchend', resumeFromGesture, { passive: true });
  document.addEventListener('click', resumeFromGesture);
  document.addEventListener('keydown', resumeFromGesture);
  // On narrow screens the film may enter the viewport only after the introduction.
  const filmVisibility = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) startFilm();
  }, { threshold: 0.05 });
  filmVisibility.observe(video);
  updateFilm();
  startFilm();

  const intro = document.getElementById('intro');
  const replay = document.getElementById('intro-replay');
  let restoreReplayFocus = false;
  let introTimer, closeTimer, openingTimer;
  const introBackground = [...document.querySelectorAll('body > .skip-link, body > header, body > main, body > footer')];
  function finishIntro() {
    clearTimeout(introTimer); clearTimeout(closeTimer); clearTimeout(openingTimer);
    intro.classList.remove('is-active', 'is-leaving', 'is-opening', 'is-turning');
    intro.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('intro-open');
    introBackground.forEach(element => { element.inert = false; });
    if (intro.contains(document.activeElement)) document.activeElement.blur();
    if (restoreReplayFocus) replay.focus({ preventScroll: true });
    restoreReplayFocus = false;
    // Retry once the covering book is actually gone, including a rendered frame on iOS.
    startFilm();
    requestAnimationFrame(startFilm);
  }
  function openBook() {
    if (!intro.classList.contains('is-active') || intro.classList.contains('is-opening')) return;
    clearTimeout(openingTimer);
    intro.classList.add('is-opening');
    startFilm();
    introTimer = setTimeout(turnPage, 1710);
  }
  function turnPage() {
    if (!intro.classList.contains('is-active') || intro.classList.contains('is-turning')) return;
    clearTimeout(introTimer);
    intro.classList.add('is-turning');
    startFilm();
    introTimer = setTimeout(closeIntro, 760);
  }
  function closeIntro() {
    if (!intro.classList.contains('is-active') || intro.classList.contains('is-leaving')) return;
    if (!intro.classList.contains('is-opening')) { openBook(); return; }
    clearTimeout(introTimer);
    intro.classList.add('is-leaving');
    startFilm();
    closeTimer = setTimeout(finishIntro, reduced.matches ? 0 : 420);
  }
  function showIntro(event) {
    clearTimeout(closeTimer); clearTimeout(introTimer); clearTimeout(openingTimer);
    if (reduced.matches) { finishIntro(); return; }
    scrollTo({ top: 0, behavior: 'instant' });
    intro.classList.remove('is-leaving', 'is-opening', 'is-turning');
    intro.classList.add('is-active');
    intro.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('intro-open');
    restoreReplayFocus = !!event && replay.matches(':focus-visible');
    introBackground.forEach(element => { element.inert = true; });
    intro.focus({ preventScroll: true });
    openingTimer = setTimeout(openBook, 450);
  }
  replay.addEventListener('click', showIntro);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && intro.classList.contains('is-active')) finishIntro(); });
  // A deep link opens its destination immediately. The film plays behind the book.
  if (!location.hash && !reduced.matches) showIntro();

  const gallery = document.getElementById('perspective-track');
  const panels = [...gallery.querySelectorAll('.float-panel')];
  const current = document.getElementById('gallery-current');
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  let dragging = false, moved = false, downX = 0, downScroll = 0, panSpeed = 0, panFrame = 0, lastPan = 0;
  const detailPanels = [...document.querySelectorAll('.perspective-detail')];
  const detailRegion = document.querySelector('.perspective-details');
  function selectPerspective(key, reveal = false) {
    panels.forEach(panel => {
      const selected = panel.dataset.view === key;
      panel.classList.toggle('is-selected', selected);
      panel.setAttribute('aria-expanded', String(selected));
      panel.querySelector('.panel-action').textContent = selected ? 'Ausgewählt' : 'Mehr erfahren';
    });
    detailPanels.forEach(panel => { panel.hidden = panel.id !== `detail-${key}`; });
    if (reveal) detailRegion.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  panels.forEach(panel => panel.addEventListener('click', () => selectPerspective(panel.dataset.view, true)));
  function updateGallery() {
    const start = gallery.getBoundingClientRect().left + parseFloat(getComputedStyle(gallery).paddingLeft);
    let closest = 0, distance = Infinity;
    panels.forEach((panel, i) => { const delta = Math.abs(panel.getBoundingClientRect().left - start); if (delta < distance) { closest = i; distance = delta; } });
    current.textContent = String(closest + 1).padStart(2, '0');
  }
  function moveGallery(direction) {
    stopPan();
    gallery.scrollBy({ left: direction * (panels[0].offsetWidth + parseFloat(getComputedStyle(gallery).gap)), behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); stopPan();
    if (event.key === 'Home' || event.key === 'End') gallery.scrollTo({ left: event.key === 'Home' ? 0 : gallery.scrollWidth, behavior: reduced.matches ? 'instant' : 'smooth' });
    else moveGallery(event.key === 'ArrowRight' ? 1 : -1);
  });
  function pan(time) {
    panFrame = 0;
    if (!panSpeed || dragging || reduced.matches) return;
    const dt = Math.min(32, time - (lastPan || time)); lastPan = time;
    const old = gallery.scrollLeft;
    gallery.scrollLeft += panSpeed * dt * .32;
    if (gallery.scrollLeft === old && dt) { stopPan(); return; }
    panFrame = requestAnimationFrame(pan);
  }
  function stopPan() { panSpeed = 0; cancelAnimationFrame(panFrame); panFrame = 0; lastPan = 0; }
  gallery.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    if (dragging) {
      const delta = event.clientX - downX;
      if (Math.abs(delta) > 6) { moved = true; gallery.classList.add('is-dragging'); }
      if (moved) gallery.scrollLeft = downScroll - delta;
      return;
    }
    if (!finePointer.matches || reduced.matches) return;
    const rect = gallery.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    panSpeed = x < .13 ? -(1 - x / .13) : x > .87 ? (x - .87) / .13 : 0;
    if (!panSpeed) stopPan();
    else if (!panFrame) panFrame = requestAnimationFrame(pan);
  });
  gallery.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    stopPan(); dragging = true; moved = false; downX = event.clientX; downScroll = gallery.scrollLeft;
  });
  function finishDrag() { dragging = false; gallery.classList.remove('is-dragging'); }
  addEventListener('pointerup', finishDrag);
  addEventListener('pointercancel', finishDrag);
  gallery.addEventListener('pointerleave', () => { stopPan(); finishDrag(); });
  gallery.addEventListener('click', event => { if (moved) { event.preventDefault(); event.stopImmediatePropagation(); moved = false; } }, true);
  gallery.addEventListener('dragstart', event => event.preventDefault());
  panels.forEach(panel => {
    panel.addEventListener('pointermove', event => {
      if (!finePointer.matches || reduced.matches || dragging) return;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty('--ry', `${((event.clientX - rect.left) / rect.width - .5) * 5}deg`);
      panel.style.setProperty('--rx', `${-((event.clientY - rect.top) / rect.height - .5) * 4}deg`);
    });
    panel.addEventListener('pointerleave', () => { panel.style.setProperty('--ry', '0deg'); panel.style.setProperty('--rx', '0deg'); });
    panel.addEventListener('focus', () => { stopPan(); });
  });
  gallery.addEventListener('scroll', updateGallery, { passive: true });
  new ResizeObserver(updateGallery).observe(gallery);
  updateGallery();
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPan(); });
  reduced.addEventListener('change', () => { stopPan(); if (reduced.matches) { clearTimeout(introTimer); clearTimeout(closeTimer); finishIntro(); } });

  const legacyTopics = { kommunikation: 'kommunikation', mediation: 'mediation', 'vor-der-kamera': 'kamera', praesenz: 'praesenz' };
  function restorePerspectiveHash() {
    const key = legacyTopics[location.hash.slice(1)];
    if (!key) return;
    selectPerspective(key);
    const panel = panels.find(item => item.dataset.view === key);
    gallery.scrollLeft = panel.offsetLeft - parseFloat(getComputedStyle(gallery).paddingLeft);
    gallery.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  addEventListener('hashchange', restorePerspectiveHash);
  addEventListener('load', restorePerspectiveHash, { once: true });

  document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  document.getElementById('year').textContent = new Date().getFullYear();
})();
