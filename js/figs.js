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

  /* tabs + caption + optional autoplay; show(k) is supplied by the figure */
  function stepper({ host, btns, cap, caps, show, interval, scrollTo }) {
    let cur = 0, timer = null, userTook = false, ready = false;
    const go = k => {
      cur = k;
      btns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === k)));
      U.clear(cap);
      caps[k].forEach(h => { const p = U.el('p', null, cap); p.innerHTML = h; });
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
      caps.forEach(c => { U.clear(cap); c.forEach(x => { const p = U.el('p', null, cap); p.innerHTML = x; }); h = Math.max(h, cap.offsetHeight); });
      cap.style.minHeight = h + 'px';
      U.clear(cap); caps[cur].forEach(x => { const p = U.el('p', null, cap); p.innerHTML = x; });
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

  /* ---------------- Fig. 1: steering mechanisms ---------------- */
  const PHI1 = '<span class="math">&phi;<sub>1</sub></span>', PHI2 = '<span class="math">&phi;<sub>2</sub></span>';
  const FIG1_CAPS = [
    [`<b>Base policy.</b> Trained on demonstrations that put the can into the trash bin and the mug onto the shelf; neither ${PHI1} <span class="pref">Put the can into the shelf.</span> nor ${PHI2} <span class="pref">Put the can to the higher place.</span> appears in them.`],
    ['<b>End-to-end policy.</b> VLAs and diffusion policies take the preference through fine-tuning, the prompt, or a guidance cost added to sampling. With no explicit task structure to edit, each new preference needs retraining or expert-written, roughly differentiable guidance.'],
    [`<b>Neuro-symbolic policy.</b> A planner edits a plan over predefined operators, e.g. dropping <code>throw(?b)</code> for <code>pick(can)</code> &rarr; <code>place(shelf)</code>, and networks execute it. The edit never reaches the controller, so the plan for ${PHI1} is logically valid but physically infeasible (a vertical-clearance violation), and ${PHI2} cannot be expressed: &ldquo;higher place&rdquo; is not in the vocabulary.`],
    ['<b>ReStruct.</b> The preference becomes an automaton that edits the policy&rsquo;s own learned state machine, and each edge&rsquo;s action priors are rebuilt from demonstrations that satisfy it. The symbols come from the demonstrations and the controller stays frozen, so the edited plan stays executable.'],
  ];
  const FIG1_BOUNDS = [0, 0.279, 0.516, 0.78, 1.01];   // panel dividers, as fractions of the figure width

  function initFig1() {
    const host = document.getElementById('fig1');
    if (!host) return;
    let lit = () => {};
    const st = stepper({
      host, btns: [...document.querySelectorAll('#fig1-tabs button')], cap: document.getElementById('fig1-cap'), caps: FIG1_CAPS,
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

  /* ---------------- Method: paper Fig. 3 (stage lit) above a running example on StackCube ---------------- */
  const c = i => `<span class="math">c<sub>${i}</sub></span>`;
  const M1 = '<span class="math">&#x2133;<sub>1</sub></span>', M2 = '<span class="math">&#x2133;<sub>2</sub></span>';
  const FIG3_CAPS = [
    ['<b>Overview.</b> The paper&rsquo;s pipeline, and below it the same pipeline on StackCube: one sentence, and the policy only ever takes the green-cube branch.'],
    [`<b>Base policy.</b> ENAP clusters camera frames into symbols and learns a state machine ${M1} over them; both stacking orders are branches of it.`],
    [`<b>1 &middot; Compile.</b> A VLM grounds &ldquo;red cube&rdquo; in the policy&rsquo;s own symbol ${c(1)} and writes <span class="math">&#9633;&not;c<sub>1</sub></span>; Spot turns it into the automaton A.`],
    [`<b>2 &middot; Reconfigure.</b> ${M2} = ${M1} &otimes; A keeps only the transitions A allows: the ${c(1)} edges are cut and q<sub>8</sub> disappears.`],
    [`<b>3 &middot; Replay.</b> Demonstrations walk ${M2}; accepted ones refill its action lists, rejected ones are discarded.`],
    [`<b>Steered policy.</b> ${M2} drives the same network weights, and the robot now always grasps the green cube.`],
  ];
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
    const st = stepper({ host, btns: [...document.querySelectorAll('#fig3-tabs button')], cap: document.getElementById('fig3-cap'), caps: FIG3_CAPS, interval: k => FIG3_DUR[k], show });
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
