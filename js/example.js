/* Method section, running example under the paper figure: StackCube steered with "Don't touch the red cube."
   One fixed-size SVG scene (1000 x 280), read left to right: inputs on the left, the result on the right.
   Stages 2-4 (compile, reconfigure A ⊗ M1 = M2, replay) are animated; overview, base and steered are still
   pictures that show the recorded rollout's path. */
(function () {
  const W = 1000, H = 280;
  const PREF = 'Don’t touch the red cube.';
  // palettes of the paper's Fig. 3: base skeleton, automaton / product, steered policy
  const PAL = {
    warm: { acc: '#787169', ink: '#787169', soft: '#EFE6D6', line: '#CFC5B6' },
    blue: { acc: '#425072', ink: '#425072', soft: '#DEE2EC', line: '#ADB7CE' },
    olive: { acc: '#50583C', ink: '#50583C', soft: '#DCE1D2', line: '#B6BDA6' },
  };

  class RunningExample {
    constructor(host) {
      this.host = host;
      this.tok = 0; this.visible = false;
      this.svg = U.svg('svg', { class: 'ex', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Running example on StackCube' }, host);
      const defs = U.svg('defs', null, this.svg);
      const cp = U.svg('clipPath', { id: 'ex-clip', clipPathUnits: 'objectBoundingBox' }, defs);
      U.svg('rect', { width: 1, height: 1, rx: 0.14 }, cp);
      const mk = U.svg('marker', { id: 'ex-ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
      U.svg('path', { d: 'M0 1.2 9 5 0 8.8z', fill: 'var(--ink-3)' }, mk);
      this.layer = U.svg('g', null, this.svg);
      this.ready = this._load();
      U.watchVisible(host, v => { this.visible = v; if (v && this._wake) { const w = this._wake; this._wake = null; w(); } }, '0px');
    }

    async _load() {
      this.T = window.PLAY_TASKS.stack;
      const [G, EX, RB, RS] = await Promise.all(['data/stack/graphs.json', 'data/stack/example.json', 'data/stack/roll_base.json', 'data/stack/roll_phi1.json'].map(u => U.json(u)));
      this.G = G; this.EX = EX; this.P = G.prefs.phi1;
      const segs = ep => { const out = []; ep.q.forEach((q, i) => { const s = [q, ep.x[i]]; const l = out[out.length - 1]; if (!l || l[0] !== s[0] || l[1] !== s[1]) out.push(s); }); return out; };
      this.baseRun = segs(RB.episodes.find(e => e.success && e.outcome === 'red_on_green'));
      this.steerRun = segs(RS.episodes.find(e => e.success && e.outcome === 'green_on_red'));
    }

    /* ---------- helpers ---------- */
    _alive(my) { return my === this.tok; }
    async _sleep(ms, my) {           // waits, and holds while the example is off screen
      await U.sleep(U.reduced ? Math.min(ms, 150) : ms);
      while (this._alive(my) && !this.visible) await new Promise(r => { this._wake = r; });
      return this._alive(my);
    }
    _t(parent, x, y, text, cls, extra) { return U.svg('text', Object.assign({ x, y, class: cls, text }, extra || {}), parent); }
    _img(parent, x, y, s, href) {
      const g = U.svg('g', { class: 'ex-img' }, parent);
      U.svg('image', { x, y, width: s, height: s, href, 'clip-path': 'url(#ex-clip)', preserveAspectRatio: 'xMidYMid slice' }, g);
      U.svg('rect', { x, y, width: s, height: s, rx: s * 0.14, class: 'ex-frame' }, g);
      return g;
    }
    _arrow(parent, x1, y, x2, label) {
      U.svg('path', { d: `M${x1} ${y} H ${x2}`, class: 'ex-arrow', 'marker-end': 'url(#ex-ar)' }, parent);
      if (label) this._t(parent, (x1 + x2) / 2, y - 8, label, 'ex-small', { 'text-anchor': 'middle' });
    }
    _in(el, delay) {                 // fade an element in after a delay
      el.style.opacity = 0;
      setTimeout(() => { el.style.transition = 'opacity .5s ease'; el.style.opacity = 1; }, U.reduced ? 0 : delay);
    }
    /* a state machine in a nested SVG: width w at (x, y), palette pal */
    _graph(x, y, w, pal, big) {          // big: larger type for graphs drawn side by side
      const s = U.svg('svg', { x, y, width: w, height: (w * 232 / 460).toFixed(1), viewBox: '0 0 460 232', overflow: 'visible' }, this.layer);
      const p = PAL[pal];
      s.style.cssText = `--acc:${p.acc};--acc-ink:${p.ink};--acc-soft:${p.soft};--acc-line:${p.line}`;
      const T = this.T;
      return new PMMGraph(s, Object.assign({ w: 460, h: 232, font: 13, labelSize: 11, loopUp: n => (T.layout[+n.id] || [0, n.y])[1] <= 120 }, big ? { font: 16, labelSize: 14, r: 15 } : {}));
    }
    _title(x, y, main, subtxt, pal, anchor) {
      const g = U.svg('g', null, this.layer), a = { 'text-anchor': anchor || 'middle' };
      const t = this._t(g, x, y, main, 'ex-name', a); t.style.fill = PAL[pal].acc;
      if (subtxt) this._t(g, x, y + 18, subtxt, 'ex-small', a);
      return g;
    }
    /* the preference automaton: one accepting state, a self-loop on every symbol except c1 */
    _automaton(g, x, y, scale, top) {   // top: loop label above the loop instead of beside it
      const r = 24 * scale, sty = { class: 'ex-auto' };
      U.svg('path', Object.assign({ d: `M${x - 12 * scale} ${y - r + 3} C ${x - 34 * scale} ${y - 78 * scale}, ${x + 34 * scale} ${y - 78 * scale}, ${x + 12 * scale} ${y - r + 3}`, 'marker-end': 'url(#ex-ar)' }, sty), g);
      U.svg('circle', Object.assign({ cx: x, cy: y, r }, sty), g);
      U.svg('circle', { cx: x, cy: y, r: r - 5 * scale, class: 'ex-auto inner' }, g);
      this._t(g, x, y + 5 * scale, 'sₐ', 'ex-auto-t', { 'text-anchor': 'middle', 'font-size': 16 * scale });
      if (top) this._t(g, x, y - 76 * scale, 'c0, c2–c6', 'ex-auto-t', { 'text-anchor': 'middle', 'font-size': 14 * Math.min(scale, 1.1) });
      else this._t(g, x + 30 * scale, y - 50 * scale, 'c0, c2–c6', 'ex-auto-t', { 'font-size': 14 * scale });
    }
    /* learned symbols in two columns: thumbnail, name, VLM caption */
    _symbols(x, y, struck) {
      const T = this.T, out = {};
      T.order.forEach((id, i) => {
        const cx = x + (i % 2) * 236, cy = y + Math.floor(i / 2) * 62;
        const g = U.svg('g', { class: 'ex-sym' + (struck && struck.includes(id) ? ' struck' : '') }, this.layer);
        this._img(g, cx, cy, 44, `data/stack/alpha_c${id}.jpg`);
        this._t(g, cx + 54, cy + 16, 'c' + id, 'ex-sym-k');
        const words = T.symbols[id].split(' '), l1 = [], l2 = [];
        words.forEach(w => ((l1.concat(w).join(' ')).length <= 27 && !l2.length ? l1 : l2).push(w));
        this._t(g, cx + 54, cy + 33, l1.join(' '), 'ex-sym-t');
        if (l2.length) this._t(g, cx + 54, cy + 48, l2.join(' '), 'ex-sym-t');
        out[id] = g;
      });
      return out;
    }
    /* the states a recorded rollout visits, in order */
    _path(run, map) { const ids = []; run.forEach(([q]) => { const k = map(q); if (k !== undefined && ids[ids.length - 1] !== k) ids.push(k); }); return ids; }
    _baseSpec() { return PLAY_SPECS.baseSpec(this.T, this.G); }
    _finalSpec() { return PLAY_SPECS.finalSpec(this.T, this.G, 'phi1'); }

    /* ---------- stages ---------- */
    async show(k) {
      const my = ++this.tok;
      await this.ready;
      if (!this._alive(my)) return;
      const mode = ['none', 'base', 'prod', 'prod', 'prod', 'steer'][k];
      ['none', 'base', 'prod', 'steer'].forEach(m => this.host.classList.toggle('mode-' + m, m === mode));
      U.clear(this.layer);
      [this._overview, this._base, this._compile, this._reconfigure, this._replay, this._steered][k].call(this, my);
    }
    stop() { this.tok++; }

    /* overview: the same robot before and after one sentence (still picture) */
    _overview() {
      const gb = this._graph(16, 28, 392, 'warm', true); gb.render(this._baseSpec());
      gb.trailFrom(this._path(this.baseRun, q => String(q)));
      const fs = this._finalSpec();
      const gs = this._graph(592, 28, 392, 'olive', true); gs.render(fs);
      gs.trailFrom(this._path(this.steerRun, fs.map));
      this._title(212, 250, 'Base policy', 'grasps either cube', 'warm');
      this._title(788, 250, 'Steered policy', 'same network weights', 'olive');
      const mid = U.svg('g', null, this.layer);
      U.svg('rect', { x: 418, y: 94, width: 164, height: 50, rx: 25, class: 'ex-pill' }, mid);
      this._t(mid, 500, 115, 'Don’t touch', 'ex-pref', { 'text-anchor': 'middle' });
      this._t(mid, 500, 134, 'the red cube.', 'ex-pref', { 'text-anchor': 'middle' });
      this._arrow(mid, 428, 172, 574);
      this._t(mid, 500, 196, 'ReStruct', 'ex-name', { 'text-anchor': 'middle' });
    }

    /* base and steered: the machine with the recorded rollout's path, beside the learned symbols (still) */
    _machine(spec, map, run, pal, name, struck) {
      const g = this._graph(14, 40, 470, pal); g.render(spec);
      g.trailFrom(this._path(run, map));
      this._t(this.layer, 26, 38, name, 'ex-big').style.fill = PAL[pal].acc;
      this._symbols(520, 22, struck);
    }
    _base() { this._machine(this._baseSpec(), q => String(q), this.baseRun, 'warm', 'M₁'); }
    _steered() { const fs = this._finalSpec(); this._machine(fs, fs.map, this.steerRun, 'olive', 'M₂', [1]); }

    /* compile: sentence -> symbols (VLM) -> formula -> automaton, left to right */
    async _compile(my) {
      const L = this.layer, y = 146, parts = [];
      let g = U.svg('g', null, L); parts.push(g);
      this._t(g, 120, y - 62, 'PREFERENCE', 'ex-kicker', { 'text-anchor': 'middle' });
      U.svg('rect', { x: 14, y: y - 36, width: 212, height: 64, rx: 32, class: 'ex-pill' }, g);
      this._t(g, 120, y - 9, 'Don’t touch', 'ex-pref xl', { 'text-anchor': 'middle' });
      this._t(g, 120, y + 16, 'the red cube.', 'ex-pref xl', { 'text-anchor': 'middle' });
      g = U.svg('g', null, L); parts.push(g);
      this._arrow(g, 234, y - 4, 276, 'VLM');
      const s = 50, gap = 6, x0 = 284, tiles = {};
      this.T.order.forEach((id, i) => {
        const t = U.svg('g', { class: 'ex-sym' }, g), x = x0 + i * (s + gap);
        this._img(t, x, y - 29, s, `data/stack/alpha_c${id}.jpg`);
        this._t(t, x + s / 2, y + 42, 'c' + id, 'ex-sym-k lg', { 'text-anchor': 'middle' });
        tiles[id] = t;
      });
      const w7 = 7 * s + 6 * gap;
      this._t(g, x0 + w7 / 2, y - 62, 'POLICY’S OWN SYMBOLS', 'ex-kicker', { 'text-anchor': 'middle' });
      const hit = this._t(g, x0 + 3 * (s + gap) + s / 2, y + 74, 'c1 = red cube in the gripper', 'ex-hit lg', { 'text-anchor': 'middle' });
      hit.style.opacity = 0;
      g = U.svg('g', null, L); parts.push(g);
      const fx = x0 + w7 + 8;
      this._arrow(g, fx, y - 4, fx + 40, 'LTLf');
      U.svg('rect', { x: fx + 48, y: y - 36, width: 140, height: 64, rx: 12, class: 'ex-box' }, g);
      this._t(g, fx + 118, y + 8, '□ ¬c1', 'ex-formula lg', { 'text-anchor': 'middle' });
      this._t(g, fx + 118, y + 54, 'never c1', 'ex-small', { 'text-anchor': 'middle' });
      g = U.svg('g', null, L); parts.push(g);
      const ax = fx + 196;
      this._arrow(g, ax, y - 4, ax + 40, 'Spot');
      this._automaton(g, ax + 82, y + 2, 1.35, true);
      this._t(g, ax + 82, y + 72, 'A', 'ex-big', { 'text-anchor': 'middle' }).style.fill = PAL.blue.acc;
      parts.forEach((p, i) => this._in(p, 150 + i * 750));
      if (!(await this._sleep(150 + 750 + 450, my))) return;
      tiles[1].classList.add('hit'); hit.style.transition = 'opacity .4s'; hit.style.opacity = 1;
    }

    /* reconfigure: A ⊗ M1 = M2 */
    async _reconfigure(my) {
      const L = this.layer;
      const ag = U.svg('g', null, L); this._automaton(ag, 50, 142, 0.95, true);
      this._title(50, 240, 'A', 'never c1', 'blue');
      this._t(L, 126, 146, '⊗', 'ex-op', { 'text-anchor': 'middle' });
      const spec = this._baseSpec();
      const g1 = this._graph(160, 14, 396, 'warm', true); g1.render(spec);
      this._title(358, 240, 'M₁', '19 transitions · 9 states', 'warm');
      const eq = this._t(L, 584, 146, '=', 'ex-op', { 'text-anchor': 'middle' });
      const g2 = this._graph(604, 14, 396, 'blue', true); g2.render(spec);
      const t2 = this._title(802, 240, 'M₂', '', 'blue');
      const sub = this._t(t2, 802, 258, '19 transitions · 9 states', 'ex-small', { 'text-anchor': 'middle' });
      [eq, g2.svg, t2].forEach(e => this._in(e, 500));
      if (!(await this._sleep(1300, my))) return;
      // a transition survives only if A allows its symbol: every c1 edge is cut
      spec.edges.filter(e => e.label === 'c1').forEach(e => { g1.edgeClass(e.s, e.d, 'flag', true); g2.edgeClass(e.s, e.d, 'cut', true); });
      if (!(await this._sleep(1200, my))) return;
      // the cut transitions, q8 (reachable only through them) and its outgoing edge disappear
      g2.nodeClass('8', 'vanish', true);
      g2.allEdges().forEach(e => { if (e.s === '8' || e.g.classList.contains('cut')) e.g.classList.add('vanish'); });
      sub.textContent = '15 transitions · 8 states';
    }

    /* replay: demonstrations (left) walked on M2 (right) */
    async _replay(my) {
      const L = this.layer, EX = this.EX;
      const spec = this._baseSpec();
      const g = this._graph(476, 14, 500, 'blue');
      g.render({ nodes: spec.nodes.filter(n => n.id !== '8'), edges: spec.edges.filter(e => e.s !== '8' && e.d !== '8') });
      this._t(L, 486, 30, 'M₂', 'ex-big').style.fill = PAL.blue.acc;
      const strip = (demo, y, name) => {
        const sg = U.svg('g', { class: 'ex-demo' }, L);
        this._t(sg, 16, y, name, 'ex-name');
        const badge = this._t(sg, 436, y, '', 'ex-badge', { 'text-anchor': 'end' });
        const n = demo.segs.length, s = 42, gap = (420 - n * s) / (n - 1);
        const frames = demo.segs.map((d, i) => {
          const f = U.svg('g', { class: 'ex-fr todo' }, sg);
          this._img(f, 16 + i * (s + gap), y + 12, s, `data/stack/${d.img}`);
          this._t(f, 16 + i * (s + gap) + s / 2, y + s + 28, 'c' + d.x, 'ex-sym-k', { 'text-anchor': 'middle' });
          return f;
        });
        return { sg, frames, badge };
      };
      const A = strip(EX.ok, 26, 'Demo A · green on red'), B = strip(EX.bad, 134, 'Demo B · red on green');
      const sum = this._t(L, 16, 256, `${this.P.n_ok} of ${this.P.replay.length} demonstrations accepted`, 'ex-name');
      sum.style.fill = PAL.blue.acc; sum.style.opacity = 0;
      const run = async (D, demo, ok) => {
        g.resetTrail(); g.highlight('0');
        for (const [i, d] of demo.segs.entries()) {
          if (!(await this._sleep(i ? 600 : 300, my))) return false;
          D.frames.forEach((f, j) => f.classList.toggle('now', j === i));
          D.frames[i].classList.remove('todo');
          if (!ok && d.x === 1) {                      // M2 has no transition for c1
            D.frames[i].classList.add('bad');
            g.nodeClass(g.current, 'bad', true);
            D.badge.textContent = '✗ rejected'; D.badge.classList.add('no');
            if (!(await this._sleep(1600, my))) return false;
            g.nodeClass(g.current, 'bad', false);
            return true;
          }
          g.highlight(String(d.q));
        }
        D.frames.forEach(f => f.classList.remove('now'));
        D.badge.textContent = '✓ accepted'; D.badge.classList.add('yes');
        g.allEdges().forEach(e => { if (e.g.classList.contains('walked')) e.g.classList.add('kept'); });
        g.allNodes().forEach(n => { if (n.g.classList.contains('walked')) n.g.classList.add('kept'); });
        return this._sleep(1500, my);
      };
      if (!(await this._sleep(400, my))) return;
      if (!(await run(A, EX.ok, true))) return;
      if (!(await run(B, EX.bad, false))) return;
      // all accepted demonstrations: the edges they use stay, the rest is pruned
      g.resetTrail();
      const keep = new Set(this._finalSpec().edges.map(e => e.s + '>' + e.d));
      g.allEdges().forEach(e => { const k = keep.has(e.s + '>' + e.d); e.g.classList.toggle('kept', k); e.g.classList.toggle('gone', !k); g._marker(e); });
      g.allNodes().forEach(n => n.g.classList.add('kept'));
      sum.style.transition = 'opacity .5s'; sum.style.opacity = 1;
    }

  }

  window.RunningExample = RunningExample;
})();
