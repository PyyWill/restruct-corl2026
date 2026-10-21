/* Results: paper numbers, SR/SRP bar charts, CALVIN chain chart, full tables. */
(function () {
  /* ---- paper Tables 1-6 ---- */
  const SIM_SETTINGS = [
    { k: 'sc1', task: 'StackCube', short: 'Stack', p: 'φ₁', pref: "Don't touch the red cube." },
    { k: 'sc2', task: 'StackCube', short: 'Stack', p: 'φ₂', pref: 'Red cube on top of the green one.' },
    { k: 'pi1', task: 'PegInsert', short: 'Peg', p: 'φ₁', pref: 'Insert the red end.' },
    { k: 'pt1', task: 'SeqPushT', short: 'PushT', p: 'φ₁', pref: 'Push to the blue pose first.' },
    { k: 'pt2', task: 'SeqPushT', short: 'PushT', p: 'φ₂', pref: 'Green pose before the blue pose.' },
  ];
  // [SR, SRP] per setting; base SR per task
  const SIM = [
    { m: 'Transformer', fam: 'reject filtering', base: [89.1, 90.6, 37.5], v: { sc1: [29.7, 29.7], sc2: [59.4, 59.4], pi1: [60.9, 60.9], pt1: [21.9, 21.9], pt2: [15.6, 15.6] } },
    { m: 'GMM', fam: 'reject filtering', base: [87.5, 85.9, 53.1], v: { sc1: [42.2, 42.2], sc2: [45.3, 45.3], pi1: [53.1, 53.1], pt1: [34.4, 34.4], pt2: [21.9, 21.9] } },
    { m: 'Diffusion Policy', fam: 'soft guidance', base: [93.8, 57.8, 40.6], v: { sc1: [87.5, 68.8], sc2: [81.2, 42.2], pi1: [42.2, 20.3], pt1: [28.1, 18.8], pt2: [31.2, 18.8] } },
    { m: 'OpenVLA', fam: 'prompt injection', base: [81.2, 68.8, 18.8], v: { sc1: [67.2, 21.9], sc2: [57.8, 28.1], pi1: [54.7, 29.7], pt1: [20.3, 12.5], pt2: [7.8, 3.1] } },
    { m: 'pi0.5', fam: 'prompt injection', base: [92.2, 85.9, 28.1], v: { sc1: [85.9, 37.5], sc2: [73.4, 48.4], pi1: [75.0, 50.0], pt1: [31.2, 26.6], pt2: [12.5, 6.2] } },
    { m: 'ReStruct', fam: 'ours', ours: true, base: [95.3, 98.4, 46.9], v: { sc1: [98.4, 98.4], sc2: [76.6, 76.6], pi1: [95.3, 95.3], pt1: [53.1, 50.0], pt2: [43.8, 34.4] } },
  ];
  const REAL_SETTINGS = [
    { k: 'cs1', task: 'CanSorting', short: 'CanSort', p: 'φ₁', pref: 'Cans should be in the red bowl.' },
    { k: 'cs2', task: 'CanSorting', short: 'CanSort', p: 'φ₂', pref: 'Place the can into the blue bowl.' },
    { k: 'tp1', task: 'PassTeaPot', short: 'TeaPot', p: 'φ₁', pref: 'Keep away from the power strip.' },
    { k: 'cc1', task: 'ConeCover', short: 'Cone', p: 'φ₁', pref: 'Cover the blue block first.' },
    { k: 'cc2', task: 'ConeCover', short: 'Cone', p: 'φ₂', pref: 'Cover the nearest block first.' },
  ];
  const REAL = [
    { m: 'pi0.5', fam: 'prompt injection', base: [100.0, 100.0, 43.8], v: { cs1: [78.1, 43.8], cs2: [71.9, 31.2], tp1: [81.2, 18.8], cc1: [43.8, 12.5], cc2: [34.4, 9.4] } },
    { m: 'ReStruct', fam: 'ours', ours: true, base: [93.3, 100.0, 87.5], v: { cs1: [100.0, 100.0], cs2: [100.0, 84.4], tp1: [100.0, 100.0], cc1: [100.0, 100.0], cc2: [78.1, 78.1] } },
  ];
  const CALVIN_SETTINGS = [
    { k: 'c1', set: 'Causal', p: 'φ₁', seq: [4, 2, 3, 1, 0] },
    { k: 'c2', set: 'Causal', p: 'φ₂', seq: [0, 2, 3, 1, 4] },
    { k: 'u1', set: 'Unconstrained', p: 'φ₁', seq: [3, 2, 0, 4, 1] },
    { k: 'u2', set: 'Unconstrained', p: 'φ₂', seq: [2, 3, 0, 4, 1] },
  ];
  const SKILLS = {
    Causal: ['rotate block', 'close drawer', 'open drawer', 'push right', 'push left'],
    Unconstrained: ['LED on', 'bulb on', 'rotate block', 'push left', 'slider right'],
  };
  const CALVIN = [
    { m: 'HULC', p: 47, v: { c1: [12.5, 10.9, 1.6], c2: [7.8, 3.1, 0.0], u1: [6.3, 0.0, 0.0], u2: [3.1, 3.1, 3.1] } },
    { m: 'LCD', p: 68, v: { c1: [15.6, 7.8, 7.8], c2: [18.8, 12.5, 12.5], u1: [14.1, 10.9, 3.1], u2: [15.6, 15.6, 9.4] } },
    { m: 'MDT', p: 440, v: { c1: [31.3, 31.3, 3.1], c2: [100.0, 100.0, 35.9], u1: [14.1, 10.9, 10.9], u2: [15.6, 15.6, 15.6] } },
    { m: 'Flower', p: 947, v: { c1: [96.9, 57.8, 57.8], c2: [92.2, 42.2, 39.1], u1: [64.1, 51.6, 45.3], u2: [73.4, 70.3, 60.9] } },
    { m: 'Flower*', p: 947, note: 'fine-tuned on the target order', v: { c1: [100.0, 87.5, 87.5], c2: [100.0, 54.7, 51.6], u1: [78.1, 78.1, 54.7], u2: [93.8, 93.8, 76.6] } },
    { m: 'ReStruct', p: 571, ours: true, v: { c1: [98.4, 93.8, 92.2], c2: [100.0, 81.3, 76.6], u1: [90.6, 84.4, 81.3], u2: [100.0, 93.8, 93.8] } },
  ];
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const PI = 'π';
  function svgName(t, name) {  // typeset pi0.5 with a real subscript
    if (name === 'pi0.5') { U.svg('tspan', { 'font-family': 'var(--math)', text: PI }, t); U.svg('tspan', { 'font-size': '0.72em', dy: 3, text: '0.5' }, t); }
    else t.textContent = name;
  }
  const htmlName = n => n === 'pi0.5' ? '<span class="math">π</span><sub>0.5</sub>' : n;

  /* ---- segmented control ---- */
  function seg(host, items, onPick, initial) {
    const s = U.el('div', { class: 'seg', role: 'group' }, host);
    const btns = items.map(it => {
      const b = U.el('button', { type: 'button', 'aria-pressed': String(it.k === initial), text: it.label }, s);
      b.onclick = () => { btns.forEach(x => x.setAttribute('aria-pressed', String(x === b))); onPick(it.k); };
      return b;
    });
    return s;
  }

  /* ---- grouped bars: one group per method, one bar per series (light to dark).
     opts: rows, series (names), shade(row, j) -> fill, label(j) -> show the value on bar j, sub(row) -> second
     label line, H. The simulation and real-robot charts share one canvas, so they are equally tall. ---- */
  const BW = 440, PL = 30, PR = 6, PT = 22;
  const SHORT = { 'Diffusion Policy': ['Diffusion', 'Policy'] };
  function bars(host, opts) {
    const rows = opts.rows, n = rows.length, K = opts.series.length;
    const BH = opts.H || 250, PB = opts.sub ? 46 : 44;
    const svg = U.svg('svg', { viewBox: `0 0 ${BW} ${BH}`, role: 'img', 'aria-label': opts.aria }, host);
    const pw = BW - PL - PR, ph = BH - PT - PB, y0 = PT + ph;
    const y = v => y0 - v / 100 * ph;
    [0, 25, 50, 75, 100].forEach(t => {
      U.svg('line', { x1: PL, x2: BW - PR, y1: y(t), y2: y(t), stroke: t ? 'var(--line)' : 'var(--line-2)', 'stroke-width': 1 }, svg);
      U.svg('text', { x: PL - 6, y: y(t) + 3.5, 'text-anchor': 'end', 'font-family': 'var(--sans)', 'font-size': 10, fill: 'var(--ink-3)', text: t }, svg);
    });
    // a slot per method; few methods get the width of four slots, centered
    const slots = Math.max(n, 4), slot = pw / slots, x0 = PL + (pw - n * slot) / 2;
    const gap = K > 2 ? 2 : 4, bw = Math.min(22, (slot * 0.66 - gap * (K - 1)) / K);
    const label = opts.label || (() => true);
    const marks = rows.map((r, i) => {
      const cx = x0 + slot * (i + 0.5), left = cx - (K * bw + (K - 1) * gap) / 2;
      const g = U.svg('g', { class: 'bar-g', tabindex: 0 }, svg);
      if (r.ours) U.svg('rect', { x: cx - slot / 2 + 3, y: PT - 14, width: slot - 6, height: ph + 14 + PB - 4, rx: 8, fill: 'var(--blue-0)' }, g);
      const bars_ = opts.series.map((_, j) => U.svg('rect', { x: left + j * (bw + gap), y: y0, width: bw, height: 0, rx: 2.5, fill: opts.shade(r, j) }, g));
      const texts = opts.series.map((_, j) => label(j) ? U.svg('text', { x: left + j * (bw + gap) + bw / 2, y: y0 - 4, 'text-anchor': 'middle', 'font-family': 'var(--sans)', 'font-size': 10, 'font-weight': r.ours ? 700 : 400, fill: r.ours ? 'var(--blue-8)' : 'var(--ink-2)' }, g) : null);
      const name = SHORT[r.m] || [r.m];
      name.forEach((ln, k) => {
        const t = U.svg('text', { x: cx, y: y0 + 16 + k * 13, 'text-anchor': 'middle', 'font-family': 'var(--sans)', 'font-size': 11.5, 'font-weight': r.ours ? 700 : 400, fill: r.ours ? 'var(--blue-8)' : 'var(--ink)' }, g);
        svgName(t, ln);
      });
      if (opts.sub) U.svg('text', { x: cx, y: y0 + 30, 'text-anchor': 'middle', 'font-family': 'var(--sans)', 'font-size': 10, fill: 'var(--ink-3)', text: opts.sub(r) }, g);
      U.svg('rect', { x: cx - slot / 2, y: PT - 14, width: slot, height: BH - PT + 14, fill: 'transparent' }, g);
      const tipFn = e => U.showTip(e, [U.line(r.m === 'pi0.5' ? PI + '0.5' : r.m, r.note ? `(${r.note})` : r.fam && !r.ours ? `(${r.fam})` : '')]
        .concat(opts.series.map((nm, j) => U.line(r.cur[j].toFixed(1) + '%', nm))));
      g.addEventListener('pointermove', tipFn); g.addEventListener('pointerleave', U.hideTip);
      g.addEventListener('focus', () => { const b = g.getBoundingClientRect(); tipFn({ clientX: b.left + b.width / 2, clientY: b.top + 20 }); });
      g.addEventListener('blur', U.hideTip);
      return { r, bars: bars_, texts, prev: opts.series.map(() => 0) };
    });
    const set = (rect, txt, v) => {
      const h = Math.max(0, v / 100 * ph);
      rect.setAttribute('y', (y0 - h).toFixed(1)); rect.setAttribute('height', h.toFixed(1));
      if (txt) { txt.setAttribute('y', (y0 - h - 4).toFixed(1)); txt.textContent = v >= 0.05 ? v.toFixed(1) : ''; }
    };
    const update = (vals, first) => {
      marks.forEach((mk, i) => {
        const v = vals[i], p0 = mk.prev;
        mk.r.cur = v;
        const run = () => U.animate(first ? 1000 : 700, t => mk.bars.forEach((b, j) => set(b, mk.texts[j], p0[j] + (v[j] - p0[j]) * t)));
        if (first && !U.reduced) setTimeout(run, i * 90); else run();
        mk.prev = v.slice();
      });
    };
    return { svg, update };
  }
  const SRSERIES = ['task success (SR)', 'kept the preference (SRP)'];
  const srShade = (r, j) => r.ours ? ['var(--blue-3)', 'var(--blue-7)'][j] : ['var(--warm-3)', 'var(--warm-7)'][j];

  function legendBars(host) {
    const lg = U.el('div', { class: 'legend-row' }, host);
    const sw = (fill, text) => { const sp = U.el('span', null, lg); sp.innerHTML = `<i class="sq" style="background:${fill}"></i>`; sp.appendChild(document.createTextNode(text)); };
    sw('var(--warm-3)', 'task success (SR)');
    sw('var(--warm-7)', 'kept the preference (SRP)');
    const b = U.el('span', { class: 'lg-ours' }, lg); b.innerHTML = '<i class="sq" style="background:var(--blue-7)"></i>ReStruct';
  }

  function buildBars(hostId, title, cap, settings, rows, aria) {
    const host = document.getElementById(hostId);
    U.onVisible(host, () => buildBarsNow(host, title, cap, settings, rows, aria), '500px 0px 500px 0px');
  }
  function buildBarsNow(host, title, cap, settings, rows, aria) {
    U.el('h3', null, host).innerHTML = title;
    U.el('p', { class: 'cap' }, host).innerHTML = cap;
    const items = [{ k: 'avg', label: 'Mean' }].concat(settings.map(s => ({ k: s.k, label: `${s.short || s.task} ${s.p}` })));
    const segHost = U.el('div', null, host);
    const prefLine = U.el('p', { class: 'note pref-line' }, host);
    const chart = bars(host, { rows, aria, series: SRSERIES, shade: srShade });
    legendBars(host);
    let shown = false;
    const pick = k => {
      const vals = rows.map(r => k === 'avg' ? [mean(settings.map(s => r.v[s.k][0])), mean(settings.map(s => r.v[s.k][1]))] : r.v[k]);
      U.clear(prefLine);
      if (k === 'avg') prefLine.textContent = `Mean over ${settings.length} preferences.`;
      else { const s = settings.find(x => x.k === k); prefLine.appendChild(document.createTextNode(`${s.task} ${s.p}: `)); U.el('span', { class: 'pref', text: s.pref }, prefLine); }
      chart.update(vals, !shown); shown = true;
    };
    seg(segHost, items, k => { if (shown) pick(k); }, 'avg');
    U.onVisible(chart.svg, () => pick('avg'), '0px 0px -15% 0px');
  }

  /* ---- CALVIN: chain success + skill graph ---- */
  function buildCalvin() {
    const host = document.getElementById('calvin-chart');
    U.onVisible(host, () => buildCalvinNow(host), '500px 0px 500px 0px');
  }
  function buildCalvinNow(host) {
    const gsvg = document.getElementById('calvin-graph');
    U.el('p', { class: 'note', text: 'First k of 5 requested skills completed, 64 trials. Flower* is fine-tuned on the requested order.' }, host);
    const segHost = U.el('div', null, host);
    const chart = bars(host, {
      rows: CALVIN, series: ['3 of 5 skills', '4 of 5 skills', '5 of 5 skills'], aria: 'Chain success on CALVIN for each method',
      shade: (r, j) => r.ours ? ['var(--blue-3)', 'var(--blue-5)', 'var(--blue-7)'][j] : ['var(--warm-3)', 'var(--warm-5)', 'var(--warm-7)'][j],
      label: j => j === 2, sub: r => `${r.p}M`, H: 262,
    });
    const lg = U.el('div', { class: 'legend-row' }, host);
    [['var(--warm-3)', '3 of 5'], ['var(--warm-5)', '4 of 5'], ['var(--warm-7)', '5 of 5 skills (value shown)']].forEach(([c, t]) => {
      const sp = U.el('span', null, lg); sp.innerHTML = `<i class="sq" style="background:${c}"></i>`; sp.appendChild(document.createTextNode(t));
    });
    const b = U.el('span', null, lg); b.innerHTML = '<i class="sq" style="background:var(--blue-7)"></i>ReStruct';
    let shown = false;
    const update = k => {
      chart.update(CALVIN.map(m => m.v[k]), !shown);
      skillGraph(gsvg, CALVIN_SETTINGS.find(s => s.k === k), true);
      shown = true;
    };
    seg(segHost, CALVIN_SETTINGS.map(s => ({ k: s.k, label: `${s.set} ${s.p}` })), k => { if (shown) update(k); }, 'u1');
    U.onVisible(chart.svg, () => update('u1'), '0px 0px -15% 0px');
  }

  let sgState = null;
  function skillGraph(svg, S, animate) {
    const names = SKILLS[S.set];
    /* skeleton ring on top, steered chain below (viewBox 440 x 400) */
    const cx = 220, cy = 128, rad = 84, nr = 17;
    const ring = i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const chainPos = j => [44 + j * 88, 336];
    U.clear(svg);
    const defs = U.svg('defs', null, svg);
    const mk = U.svg('marker', { id: 'cv-ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
    U.svg('path', { d: 'M0 1.2 9 5 0 8.8z', fill: 'var(--blue-7)' }, mk);
    U.svg('text', { x: 0, y: 18, 'font-family': 'var(--sans)', 'font-size': 14, fill: 'var(--ink-3)', text: 'learned skeleton' }, svg);
    const mk2 = U.svg('marker', { id: 'cv-ar2', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
    U.svg('path', { d: 'M0 1.2 9 5 0 8.8z', fill: 'var(--ink-3)' }, mk2);
    U.svg('path', { d: `M${cx} 244 v 36`, stroke: 'var(--ink-3)', 'stroke-width': 1.3, 'marker-end': 'url(#cv-ar2)' }, svg);
    U.svg('text', { x: cx + 14, y: 267, 'font-family': 'var(--math)', 'font-size': 15, fill: 'var(--olive-7)', text: '⊗ φ' }, svg);
    U.svg('text', { x: cx + 48, y: 267, 'font-family': 'var(--sans)', 'font-size': 14, fill: 'var(--ink-3)', text: `${S.set} ${S.p}` }, svg);
    const allowed = (a, b) => !(S.set === 'Causal' && a === 1 && b === 2);
    const gE = U.svg('g', null, svg), gN = U.svg('g', null, svg);
    const edges = [];
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (a !== b && allowed(a, b)) {
      const [x1, y1] = ring(a), [x2, y2] = ring(b);
      const ln = U.svg('line', { x1, y1, x2, y2, stroke: 'var(--blue-3)', 'stroke-width': 1, opacity: 0.7 }, gE);
      edges.push({ a, b, ln });
    }
    const nodes = names.map((nm, i) => {
      const g = U.svg('g', null, gN);
      const [x, y] = ring(i);
      g.setAttribute('transform', `translate(${x},${y})`);
      U.svg('circle', { r: nr, fill: 'var(--paper)', stroke: 'var(--blue-7)', 'stroke-width': 1.5 }, g);
      U.svg('text', { y: 5, 'text-anchor': 'middle', 'font-family': 'var(--serif)', 'font-size': 14, fill: 'var(--blue-8)', text: String(i) }, g);
      const lab = U.svg('text', { y: nr + 15, 'text-anchor': 'middle', 'font-family': 'var(--sans)', 'font-size': 12.5, fill: 'var(--ink-2)', text: nm }, g);
      return { g, x, y, lab };
    });
    const chainLines = S.seq.slice(0, -1).map((s, j) => {
      const [x1, y1] = chainPos(j), [x2, y2] = chainPos(j + 1);
      return U.svg('line', { x1: x1 + nr, y1, x2: x2 - nr - 2, y2, stroke: 'var(--blue-7)', 'stroke-width': 1.8, 'marker-end': 'url(#cv-ar)', opacity: 0 }, gE);
    });
    // ghost copy of the full graph stays on the left
    const ghost = U.svg('g', { opacity: 0.0 }, svg);
    svg.insertBefore(ghost, gE);
    edges.forEach(e => U.svg('line', { x1: e.ln.getAttribute('x1'), y1: e.ln.getAttribute('y1'), x2: e.ln.getAttribute('x2'), y2: e.ln.getAttribute('y2'), stroke: 'var(--blue-3)', 'stroke-width': 1 }, ghost));
    names.forEach((nm, i) => { const [x, y] = ring(i); U.svg('circle', { cx: x, cy: y, r: nr, fill: 'var(--paper)', stroke: 'var(--blue-3)', 'stroke-width': 1.3 }, ghost); U.svg('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-family': 'var(--serif)', 'font-size': 14, fill: 'var(--ink-3)', text: String(i) }, ghost); });
    const run = () => U.animate(animate ? 1500 : 0, t => {
      ghost.setAttribute('opacity', (0.75 * t).toFixed(2));
      S.seq.forEach((s, j) => {
        const n = nodes[s]; const [x0, y0] = ring(s); const [x1, y1] = chainPos(j);
        const x = x0 + (x1 - x0) * t, yy = y0 + (y1 - y0) * t;
        n.g.setAttribute('transform', `translate(${x},${yy})`);
        n.lab.setAttribute('y', j % 2 ? -(nr + 7) : nr + 15);
      });
      edges.forEach(e => {
        const A = nodes[e.a].g.transform.baseVal.consolidate().matrix, B = nodes[e.b].g.transform.baseVal.consolidate().matrix;
        e.ln.setAttribute('x1', A.e); e.ln.setAttribute('y1', A.f); e.ln.setAttribute('x2', B.e); e.ln.setAttribute('y2', B.f);
        e.ln.setAttribute('opacity', (0.7 * Math.max(0, 1 - t * 1.6)).toFixed(2));
      });
      chainLines.forEach(l => l.setAttribute('opacity', Math.max(0, (t - 0.6) / 0.4).toFixed(2)));
    }, U.easeInOut);
    if (animate && !U.reduced) setTimeout(run, 500); else run();
  }

  /* groups: column counts per group header (first data column = index 0); skip: data columns not ranked */
  function table(host, caption, head, rows, groups, skip = []) {
    const wrap = U.el('div', { class: 'tbl' }, host);
    const t = U.el('table', null, wrap);
    U.el('caption', { text: caption }, t);
    const th = U.el('thead', null, t);
    head.forEach(hr => { const tr = U.el('tr', null, th); hr.forEach(h => { const c = U.el('th', null, tr); c.innerHTML = h[0]; if (h[1]) c.colSpan = h[1]; }); });
    const starts = new Set(); let acc = 0; groups.forEach(g => { starts.add(acc); acc += g; });
    const ncol = rows[0].v.length;
    const best = [...Array(ncol)].map((_, j) => skip.includes(j) ? null : Math.max(...rows.map(r => typeof r.v[j] === 'number' ? r.v[j] : -1)));
    const tb = U.el('tbody', null, t);
    rows.forEach(r => {
      const tr = U.el('tr', { class: r.ours ? 'ours' : '' }, tb);
      U.el('td', null, tr).innerHTML = htmlName(r.m);
      r.v.forEach((v, j) => {
        const cls = [starts.has(j) ? 'g0' : '', best[j] !== null && v === best[j] ? 'best' : ''].join(' ').trim();
        U.el('td', { class: cls, text: typeof v === 'number' ? v.toFixed(1) : v }, tr);
      });
    });
  }
  function buildTables() {
    // tools/prerender.py writes these tables into index.html so crawlers that skip scripts can read the numbers;
    // without that, build them when the browser is idle rather than on scroll, so the sections below never shift
    const det = document.getElementById('tables'), body = document.getElementById('tables-body');
    if (body.querySelector('table')) return;
    let done = false;
    const go = () => { if (!done) { done = true; buildTablesNow(body); } };
    U.idle(go, 2000);
    U.onVisible(det, go, 1200);
  }
  function buildTablesNow(host) {
    const sub = ['Base SR', 'φ₁ SR', 'φ₁ SRP', 'φ₂ SR', 'φ₂ SRP'], sub3 = ['Base SR', 'φ₁ SR', 'φ₁ SRP'];
    const hdr = (names, n) => [[['Method']].concat(names.map((nm, i) => [nm, n[i]])),
                               [['']].concat(n.flatMap(k => (k === 5 ? sub : sub3)).map(x => [x]))];
    table(host, 'Table 1 · ManiSkill, 64 trials over 8 seeds. SR: task success; SRP: success with the preference kept.',
      hdr(['StackCube', 'PegInsert', 'SeqPushT'], [5, 3, 5]),
      SIM.map(r => ({ m: r.m, ours: r.ours, v: [r.base[0], ...r.v.sc1, ...r.v.sc2, r.base[1], ...r.v.pi1, r.base[2], ...r.v.pt1, ...r.v.pt2] })), [5, 3, 5]);
    table(host, 'Table 2 · Real robot (Kinova Gen3), 32 trials.',
      hdr(['CanSorting', 'PassTeaPot', 'ConeCover'], [5, 3, 5]),
      REAL.map(r => ({ m: r.m, ours: r.ours, v: [r.base[0], ...r.v.cs1, ...r.v.cs2, r.base[1], ...r.v.tp1, r.base[2], ...r.v.cc1, ...r.v.cc2] })), [5, 3, 5]);
    table(host, 'Table 3 · CALVIN, success of the first k of 5 requested skills, 64 trials. Flower* is fine-tuned on the requested order.', [
      [['Method'], ['Params'], ['Causal φ₁', 3], ['Causal φ₂', 3], ['Unconstrained φ₁', 3], ['Unconstrained φ₂', 3]],
      [[''], ['(M)'], ['3/5'], ['4/5'], ['5/5'], ['3/5'], ['4/5'], ['5/5'], ['3/5'], ['4/5'], ['5/5'], ['3/5'], ['4/5'], ['5/5']],
    ], CALVIN.map(r => ({ m: r.m, ours: r.ours, v: [String(r.p), ...r.v.c1, ...r.v.c2, ...r.v.u1, ...r.v.u2] })), [1, 3, 3, 3, 3], [0]);
  }

  window.Charts = {
    init() {
      buildBars('chart-sim', 'Simulation', 'ManiSkill · 64 trials over 8 seeds.',
        SIM_SETTINGS, SIM, 'Simulation results: task success and preference-following per method');
      buildBars('chart-real', 'Real robot', 'Kinova Gen3 · 32 trials · <span class="math">π</span><sub>0.5</sub> steered through its prompt.',
        REAL_SETTINGS, REAL, 'Real-robot results: task success and preference-following');
      buildCalvin();
      buildTables();
    },
    tablesHTML() { const d = document.createElement('div'); buildTablesNow(d); return d.innerHTML; },   // for tools/prerender.py
  };
})();
