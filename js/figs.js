/* Paper figures (PowerPoint SVG exports), inlined so the page's web fonts apply.
   Fig. 1: one panel lit at a time.  Fig. 3: the method in stages; each stage lights its parts and a
   marker traces that stage's flow along the figure's own arrows.  Both cycle until the reader clicks. */
(function () {
  let uid = 0;

  async function inline(host) {
    const pfx = 'f' + (++uid) + '-';
    let txt = await (await fetch(host.dataset.svg)).text();
    txt = txt.replace(/<\?xml[^>]*>/, '')
      .replace(/\bid="([^"]+)"/g, (m, id) => `id="${pfx}${id}"`)
      .replace(/url\(#([^)]+)\)/g, (m, id) => `url(#${pfx}${id})`)
      .replace(/(xlink:href|href)="#([^"]+)"/g, (m, a, id) => `${a}="#${pfx}${id}"`);
    host.innerHTML = txt;
    const svg = host.querySelector('svg');
    const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', host.getAttribute('aria-label') || '');
    return { svg, w, h };
  }

  /* top-level parts of the export with their box in figure fractions */
  function parts(svg) {
    const R = svg.getBoundingClientRect(), root = svg.querySelector(':scope > g');
    return [...(root ? root.children : [])].map(n => {
      const r = n.getBoundingClientRect();
      return { n, x: (r.left - R.left) / R.width, y: (r.top - R.top) / R.height, w: r.width / R.width, h: r.height / R.height };
    });
  }

  /* Two copies of a figure: the whole figure underneath, faded as one flat layer (like an image, so overlapping
     parts keep their occlusion), and on top only the parts of the lit stage at full strength.
     stageOf(part) -> stage index, or -1 for parts that always stay (titles, dividers). */
  async function layered(host, stageOf) {
    const { svg } = await inline(host);
    const top = U.el('div', { class: 'fig-top', 'aria-hidden': 'true' }, host);
    top.dataset.svg = host.dataset.svg;
    const { svg: svg2 } = await inline(top);
    svg2.removeAttribute('role'); svg2.removeAttribute('aria-label');
    const items = parts(svg2).map(p => ({ n: p.n, s: stageOf(p) }));
    svg.style.transition = 'opacity .45s ease';
    return k => {                    // k: stage to light; null lights everything
      svg.style.opacity = k === null ? 1 : 0.16;
      top.style.transition = 'none'; top.style.opacity = 0;
      if (k !== null) {
        items.forEach(it => { it.n.style.visibility = (it.s === -1 || it.s === k) ? 'visible' : 'hidden'; });
        requestAnimationFrame(() => requestAnimationFrame(() => { top.style.transition = 'opacity .45s ease'; top.style.opacity = 1; }));
      }
    };
  }

  /* tabs + caption + optional autoplay; show(k) is supplied by the figure.
     The captions are written in the page, one <p> per tab, so they are part of the HTML that crawlers read;
     this only shows the one for the current tab. */
  function stepper({ host, btns, cap, show, interval, scrollTo }) {
    const caps = [...cap.children];
    let cur = 0, timer = null, userTook = false, ready = false;
    const only = k => caps.forEach((p, i) => { p.hidden = i !== k; });
    const go = k => {
      cur = k;
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
      only(k);
      if (ready) show(k);
      // narrow screens scroll the figure sideways: bring the lit part into view
      if (ready && scrollTo && host.scrollWidth > host.clientWidth + 4) {
        const f = scrollTo(k);
        if (f != null) host.scrollTo({ left: Math.max(0, f * host.scrollWidth - host.clientWidth / 2), behavior: U.reduced ? 'auto' : 'smooth' });
      }
    };
    btns.forEach((b, i) => b.addEventListener('click', () => { userTook = true; clearTimeout(timer); go(i); }));
    const fit = () => {          // reserve the height of the tallest caption so tabs never move the page
      cap.style.minHeight = '';
      let h = 0;
      caps.forEach((_, i) => { only(i); h = Math.max(h, cap.offsetHeight); });
      cap.style.minHeight = h + 'px';
      only(cur);
    };
    let rt = null;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 150); });
    go(0); fit();
    // interval: ms per stage, or a function of the stage
    const dur = k => (typeof interval === 'function' ? interval(k) : interval);
    const tick = () => { timer = setTimeout(() => { if (!userTook) { go((cur + 1) % caps.length); tick(); } }, dur(cur)); };
    return {
      ready() { ready = true; go(cur); },
      autoplay() {
        if (U.reduced) return;
        U.watchVisible(host, v => { clearTimeout(timer); if (v && !userTook) tick(); }, '0px');
      },
    };
  }

  /* ---------------- Fig. 1: steering mechanisms (captions in #fig1-cap) ---------------- */
  const FIG1_BOUNDS = [0, 0.279, 0.516, 0.78, 1.01];   // panel dividers, as fractions of the figure width

  function initFig1() {
    const host = document.getElementById('fig1');
    if (!host) return;
    let lit = () => {};
    const st = stepper({
      host, btns: [...document.querySelectorAll('#fig1-tabs button')], cap: document.getElementById('fig1-cap'),
      interval: 6500, scrollTo: k => (FIG1_BOUNDS[k] + FIG1_BOUNDS[k + 1]) / 2,
      show: k => lit(k),
    });
    U.onVisible(host, async () => {
      try {
        // a part belongs to the panel its centre falls in; the panel captions below the drawings are part of it
        lit = await layered(host, p => { const cx = p.x + p.w / 2; return (!p.w && !p.h) ? -2 : FIG1_BOUNDS.findIndex((b, i) => cx >= b && cx < FIG1_BOUNDS[i + 1]); });
        st.ready(); st.autoplay();
      } catch (e) { host.textContent = ''; }
    }, 400);
  }

  /* ---------------- Method: paper Fig. 3 (stage lit) above a running example on StackCube (captions in #fig3-cap) ---------------- */
  const FIG3_DUR = [6000, 6000, 6500, 6500, 13000, 6000];   // autoplay time per stage, long enough for its animation
  /* stage of a part of the paper figure, from its box in figure fractions; -1 = always shown (titles, dividers) */
  function fig3Stage(p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    if (!p.w && !p.h) return -1;
    if (cy < 0.065) return -1;                                  // panel titles
    if (p.h > 0.4 && p.w < 0.03) return -1;                     // panel dividers
    if (p.w > 0.25 && p.h < 0.03 && cy > 0.68 && cy < 0.78) return 5;   // same network weights carried into the steered policy
    if (p.x > 0.68 && p.x < 0.715 && p.x + p.w > 0.725 && cy > 0.45 && cy < 0.65) return 5;   // product skeleton handed to the steered policy
    if (cx < 0.43 || (cx < 0.495 && cy < 0.4)) return 1;       // panel (a); its skeleton box reaches past the divider
    if (cx < 0.715) {
      if (cx > 0.535 && cx < 0.585 && cy > 0.22 && cy < 0.43) return 3;   // product operator and its output arrow
      if (cy < 0.3 && cx < 0.585 && p.y > 0.25) return 3;                 // skeleton fed into the product
      if (cy < 0.4) return 2;
      if (cy < 0.635) return 3;
      return 4;
    }
    return cy < 0.565 ? 4 : 5;
  }

  function initFig3() {
    const host = document.getElementById('fig3');
    if (!host) return;
    const paper = host.querySelector('.ms-paper'), exHost = host.querySelector('.ex-panel');
    let lit = () => {}, ex = null;
    const show = k => { lit(k === 0 ? null : k); ex = ex || new RunningExample(exHost); ex.show(k); };
    const st = stepper({ host, btns: [...document.querySelectorAll('#fig3-tabs button')], cap: document.getElementById('fig3-cap'), interval: k => FIG3_DUR[k], show });
    U.onVisible(host, async () => {
      try { lit = await layered(paper, fig3Stage); } catch (e) { paper.textContent = ''; }
      st.ready(); st.autoplay();
    }, 400);
  }

  /* Fig. 2 (ENAP diagram) in the preliminary: inlined so the page fonts apply */
  function initFig2() {
    const host = document.getElementById('fig2');
    if (host) U.onVisible(host, () => inline(host).catch(() => { host.textContent = ''; }), 600);
  }

  window.Figs = { init() { initFig1(); initFig2(); initFig3(); } };
})();
