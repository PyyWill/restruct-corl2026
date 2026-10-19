/* Page bootstrap: navigation, reveal-on-scroll, counters, idle prefetch, lazy module start-up. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* nav: highlight the section under the upper third of the viewport */
  const links = $$('.nav a.nl');
  const sections = ['idea', 'why', 'method', 'try', 'results', 'reuse'].map(id => document.getElementById(id)).filter(Boolean);
  let navTick = false;
  const navUpdate = () => {
    navTick = false;
    const y = window.innerHeight * 0.35;
    let cur = null;
    sections.forEach(s => { if (s.getBoundingClientRect().top < y) cur = s.id; });
    links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + cur));
  };
  window.addEventListener('scroll', () => { if (!navTick) { navTick = true; requestAnimationFrame(navUpdate); } }, { passive: true });

  /* reveal: only elements still below the fold are hidden, and only once JS runs */
  const reveal = () => {
    if (U.reduced) return;
    const vh = window.innerHeight;
    $$('.rv').forEach(el => {
      if (el.getBoundingClientRect().top > vh * 0.98) { el.classList.add('pre'); U.onVisible(el, () => el.classList.remove('pre'), -30); }
    });
  };

  /* counters */
  $$('[data-count]').forEach(el => U.onVisible(el, () => U.countUp(el)));

  /* warm caches while the reader is still at the top: three.js and the StackCube scene,
     then shader compilation, then the playground's first task */
  function prefetch() {
    U.idle(async () => {
      try {
        await RolloutViewer.prewarm('data/stack');
        await U.idleP(3000);
        U.json('data/stack/graphs.json');
        RolloutViewer.preloadRollouts('data/stack', ['base']);
      } catch (e) { /* the sections load on demand anyway */ }
    }, 3000);
  }

  /* BibTeX copy button */
  function bibCopy() {
    const b = $('#bib-copy'); if (!b) return;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#bib-text').textContent); b.textContent = 'Copied'; }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('#bib-text')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'Selected'; }
      setTimeout(() => { b.textContent = 'Copy'; }, 1600);
    });
  }

  function start() {
    bibCopy();
    reveal();
    RealVideos.initTeaser();
    U.onVisible($('#reuse'), () => RealVideos.initCanSort(), '500px 0px 500px 0px');
    Figs.init();
    U.onVisible($('#try'), () => { window.__pg = new Playground(document.getElementById('try')); }, '600px 0px 600px 0px');
    Charts.init();
    if (document.readyState === 'complete') prefetch(); else window.addEventListener('load', prefetch, { once: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
