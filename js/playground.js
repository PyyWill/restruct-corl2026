/* "Steer it yourself": preference -> automaton -> product -> replay -> execute,
   synchronized with recorded rollouts of the frozen policy. */
(function () {
  const TASKS = {
    stack: {
      name: 'StackCube', dir: 'data/stack', w: 460, h: 232,
      layout: { 0: [24, 108], 1: [86, 108], 2: [138, 54], 3: [200, 108], 4: [282, 46], 5: [368, 98], 6: [436, 98], 7: [236, 180], 8: [358, 180] },
      bends: { '4>5': 0, '8>5': 0 },
      order: [5, 6, 4, 1, 2, 3, 0],
      symbols: { 5: 'start pose', 6: 'arm starts moving', 4: 'reaching for the red cube', 1: 'red cube in the gripper', 2: 'green cube in the gripper', 3: 'cube lowered onto the other', 0: 'transition frames' },
      chips: [['phi1', 'Avoid red.'], ['phi2', "Don't touch the green cube."], ['phi2', 'Stack the red cube on top of the green one.']],
      prefs: [
        { key: 'phi1', paper: 'φ₁', texts: ["Don't touch the red cube."], forbid: ['c1'], dfaNote: 'never c1, the red-cube grasp.' },
        { key: 'phi2', paper: 'φ₂', texts: ['Red cube on top of the green one.'], forbid: ['c2'], dfaNote: 'never c2, the green-cube grasp.' },
      ],
      outcome: { base: { red_on_green: 'ok', green_on_red: 'ok' }, phi1: { green_on_red: 'ok', red_on_green: 'viol' }, phi2: { red_on_green: 'ok', green_on_red: 'viol' } },
      outText: { red_on_green: 'red on green', green_on_red: 'green on red', fail: 'task failed' },
    },
    peg: {
      name: 'PegInsert', dir: 'data/peg', w: 460, h: 232,
      layout: { 0: [28, 118], 1: [120, 54], 5: [120, 176], 4: [252, 176], 2: [304, 54], 3: [432, 118] },
      loopDown: [5, 4, 3],
      order: [1, 2, 3, 0],
      symbols: { 1: 'start, gripper above the peg', 2: 'gripper lowering onto the peg', 3: 'peg entering the hole', 0: 'transition frames' },
      split: { c3a: 'red end entering the hole', c3b: 'white end entering the hole' },
      chips: [['phi1', 'Red end in.'], ['tail', 'Insert the white end.'], ['phi1', 'Keep the white end of the peg out of the hole.']],
      prefs: [
        { key: 'phi1', paper: 'φ₁', texts: ['Insert the red end.'], split: true, forbid: ['c3b'], dfaNote: 'never c3ᵦ, the white end entering.' },
        { key: 'tail', paper: null, texts: ['Insert the white end.'], split: true, forbid: ['c3a'], extra: true, dfaNote: 'never c3ₐ, the red end entering.' },
      ],
      outcome: { base: { head: 'ok', tail: 'ok' }, phi1: { head: 'ok', tail: 'viol' }, tail: { tail: 'ok', head: 'viol' } },
      outText: { head: 'red end inserted', tail: 'white end inserted', fail: 'task failed' },
    },
    pusht: {
      name: 'SeqPushT', dir: 'data/pusht', w: 460, h: 232, basePick: 9,   // recorded episode shown for the base policy
      // steered product: [x, y, loop] per final state, laid out flat in three phases (before the first pose,
      // first pose done, accepted); states are renumbered because one skeleton state appears in several phases
      steer: {
        phi1: { pos: [[28, 112], [108, 56, 'up'], [318, 56, 'up'], [150, 168, 'down'], [318, 168, 'down'], [432, 56, 'up'], [234, 168, 'down'], [432, 168, 'down']] },
        phi2: { pos: [[28, 112], [108, 56, 'up'], [150, 168, 'down'], [340, 168, 'down'], [432, 56, 'up'], [432, 168, 'down'], [222, 56, 'up'], [262, 168, 'down']] },
      },
      layout: { 0: [26, 118], 1: [140, 180], 2: [238, 100], 3: [370, 42], 4: [370, 182] },
      order: [2, 1, 3, 0],
      symbols: { 2: 'start, T near its initial spot', 1: 'T at the blue pose', 3: 'T at the green pose', 0: 'transition frames' },
      chips: [['phi1', 'Blue first.'], ['phi2', 'Push to the green pose first.'], ['phi1', 'Visit the blue pose before the green one.']],
      prefs: [
        { key: 'phi1', paper: 'φ₁', texts: ['Push to the blue pose first.'],
          dfaNote: 'c1 (blue pose) before c3 (green pose).',
          bands: { q0: 's₀ · before blue', q1: 's₁ · blue done', qA: 'sₐ · accepted' } },
        { key: 'phi2', paper: 'φ₂', texts: ['Green pose before the blue pose.'],
          dfaNote: 'c3 (green pose) before c1 (blue pose).',
          bands: { q0: 's₀ · before green', q1: 's₁ · green done', qA: 'sₐ · accepted' } },
      ],
      outcome: { base: { blue_first: 'ok', green_first: 'ok' }, phi1: { blue_first: 'ok', green_first: 'viol' }, phi2: { green_first: 'ok', blue_first: 'viol' } },
      outText: { blue_first: 'blue first', green_first: 'green first', fail: 'task failed' },
    },
  };

  /* ---------- free-text preference matching (no model: keyword rules over this demo's symbols) ---------- */
  const NEG = /\b(don'?t|do not|never|avoid|not|no|without|leave|keep\s+(?:away|off|out)|out of|stay away|skip)\b/;
  function match(task, raw) {
    const s = ' ' + raw.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    const has = w => s.includes(' ' + w + ' ') || s.includes(' ' + w + 's ');
    if (task === 'stack') {
      const r = has('red'), g = has('green');
      if (!r && !g) return null;
      let m = /(red|green)(?: cube| block| one)? (?:on top of|on|onto|above|over) (?:the )?(red|green)/.exec(s);
      if (m && m[1] !== m[2]) return m[1] === 'red' ? 'phi2' : 'phi1';
      m = /(red|green)(?: cube| block| one)? (?:under|below|beneath|at the bottom)/.exec(s);
      if (m) return m[1] === 'red' ? 'phi1' : 'phi2';
      const neg = NEG.test(s);
      const target = r && !g ? 'red' : g && !r ? 'green' : (s.indexOf('red') < s.indexOf('green') ? 'red' : 'green');
      if (neg) return target === 'red' ? 'phi1' : 'phi2';
      if (/\b(grasp|grab|pick|touch|lift|move|take|use|manipulate|first|only)\b/.test(s)) return target === 'red' ? 'phi2' : 'phi1';
      return null;
    }
    if (task === 'peg') {
      const red = has('red') || has('orange') || has('colored') || has('coloured');
      const white = has('white');
      if (!red && !white) return null;
      const target = red && !white ? 'red' : white && !red ? 'white' : (s.search(/red|orange/) < s.indexOf('white') ? 'red' : 'white');
      const neg = NEG.test(s);
      const wantRed = neg ? target === 'white' : target === 'red';
      return wantRed ? 'phi1' : 'tail';
    }
    if (task === 'pusht') {
      const b = has('blue'), g = has('green');
      if (!b && !g) return null;
      let m = /(blue|green).*\b(before|then|prior to|ahead of)\b.*(blue|green)/.exec(s);
      if (m && m[1] !== m[3]) return m[1] === 'blue' ? 'phi1' : 'phi2';
      m = /(blue|green).*\b(after)\b.*(blue|green)/.exec(s);
      if (m && m[1] !== m[3]) return m[1] === 'blue' ? 'phi2' : 'phi1';
      const target = b && !g ? 'blue' : g && !b ? 'green' : (s.indexOf('blue') < s.indexOf('green') ? 'blue' : 'green');
      const last = /\b(last|second|later|finally)\b/.test(s);
      const neg = NEG.test(s);
      const first = (last || neg) ? target !== 'blue' : target === 'blue';
      return first ? 'phi1' : 'phi2';
    }
    return null;
  }

  /* graph specs: base skeleton, and the steered skeleton (product after replay) */
  function baseSpec(T, G) {
    return {
      nodes: G.base.nodes.map(n => ({ id: String(n.id), x: T.layout[n.id][0], y: T.layout[n.id][1], label: 'q' + n.id })),
      edges: G.base.edges.map(e => ({ s: String(e.s), d: String(e.d), label: 'c' + e.x, bend: (T.bends || {})[`${e.s}>${e.d}`] })),
    };
  }
  function finalSpec(T, G, key) {
    const P = G.prefs[key], p = T.prefs.find(q => q.key === key);
    const lab = x => (p.split && x === 3) ? (p.forbid[0] === 'c3b' ? 'c3a' : 'c3b') : 'c' + x;
    const L = (T.steer || {})[key];
    if (L) {
      const id = i => String(i);
      return { map: id,
        nodes: P.final.nodes.map((n, i) => ({ id: id(i), x: L.pos[i][0], y: L.pos[i][1], loop: L.pos[i][2], label: 'q' + i, acc: n.qb === 'qA' })),
        edges: P.final.edges.map(e => ({ s: id(e.s), d: id(e.d), label: lab(e.x), bend: (L.bends || {})[`${e.s}>${e.d}`] })) };
    }
    const id = i => String(P.final.nodes[i].qm);
    return { map: id,
      nodes: P.final.nodes.map(n => ({ id: String(n.qm), x: T.layout[n.qm][0], y: T.layout[n.qm][1], label: 'q' + n.qm })),
      edges: P.final.edges.map(e => ({ s: id(e.s), d: id(e.d), label: lab(e.x), bend: (T.bends || {})[`${id(e.s)}>${id(e.d)}`] })) };
  }

  const fmt = (n, d = 0) => Number(n).toFixed(d);
  const sub = { a: 'ₐ' };

  class Playground {
    constructor(root) {
      this.root = root;
      this.el = id => root.querySelector('#' + id);
      this.viewer = new RolloutViewer(this.el('stage-play'), { trail: '#5C6F9E' });
      const gopts = { w: 460, h: 232, font: 13, labelSize: 11,
        loopUp: n => {
          const T = TASKS[this.task] || {}, qm = +String(n.id).split('|')[0];
          const by = T.layout && T.layout[qm] ? T.layout[qm][1] : n.y;
          return T.loopDown ? !T.loopDown.includes(qm) : by <= 120;
        } };
      this.gBase = new PMMGraph(this.el('pg-base'), gopts);    // base skeleton, follows the base rollout
      this.graph = new PMMGraph(this.el('pg-steer'), gopts);   // steered skeleton: product, then replay
      this.task = null; this.pref = null; this.stepIdx = -1; this.token = 0;
      this.viewer.on((type, p) => this._onViewer(type, p));
      this.el('pg-tasks').addEventListener('click', e => {
        const b = e.target.closest('button[data-task]'); if (!b) return;
        this.setTask(b.dataset.task);
      });
      this.el('pg-form').addEventListener('submit', e => { e.preventDefault(); this._submitText(); });
      ['peek-1', 'peek-2'].forEach(id => this.el(id).addEventListener('click', e => {
        const k = +e.currentTarget.dataset.k; if (!e.currentTarget.disabled) this._goto(k);
      }));
      this.setTask('stack');
    }

    /* ---------- task ---------- */
    async setTask(task) {
      const my = ++this.token;
      this.task = task; this.pref = null;
      const T = TASKS[task];
      this.el('pg-tasks').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.task === task)));
      this.el('pg-text').placeholder = 'e.g. ' + T.prefs[0].texts[0];
      this.el('pg-text').value = '';
      this.el('pg-msg').textContent = '';
      this.el('pg-msg').classList.remove('warn');
      const [g] = await Promise.all([U.json(T.dir + '/graphs.json'), this.viewer.loadScene(T.dir, task)]);
      if (my !== this.token) return;
      this.G = g;
      this._chips();
      this._alphabet();
      await this._enterBase();
    }

    _chips() {
      const T = TASKS[this.task], box = this.el('pg-chips');
      U.clear(box);
      const base = U.el('button', { type: 'button', class: 'chip base', 'aria-pressed': 'true', text: 'No preference' }, box);
      base.dataset.pref = '';
      T.chips.forEach(([key, t]) => {
        const b = U.el('button', { type: 'button', class: 'chip', 'aria-pressed': 'false' }, box);
        b.dataset.pref = key; b.dataset.text = t;
        b.appendChild(document.createTextNode(t));
      });
      box.onclick = e => {
        const b = e.target.closest('button.chip'); if (!b) return;
        this.el('pg-msg').textContent = ''; this.el('pg-msg').classList.remove('warn');
        if (!b.dataset.pref) { this._pressChip(''); this._enterBase(); }
        else { this.el('pg-text').value = b.dataset.text; this.steer(b.dataset.pref, b.dataset.text); }
      };
    }
    _pressChip(prefKey, text) {
      const chips = [...this.el('pg-chips').querySelectorAll('.chip')];
      if (prefKey && text && !chips.some(c => c.dataset.text === text)) text = null;  // typed text: light the canonical chip
      chips.forEach((c, i) => {
        const first = chips.findIndex(x => x.dataset.pref === prefKey) === i;
        const on = prefKey ? (c.dataset.pref === prefKey && (text ? c.dataset.text === text : first)) : !c.dataset.pref;
        c.setAttribute('aria-pressed', String(on));
      });
    }
    _submitText() {
      const txt = this.el('pg-text').value.trim();
      const msg = this.el('pg-msg');
      if (!txt) return;
      const key = match(this.task, txt);
      const T = TASKS[this.task];
      if (!key) {
        msg.classList.add('warn');
        msg.textContent = 'Not recognized for this task. Try a suggestion above.';
        return;
      }
      const p = T.prefs.find(q => q.key === key);
      msg.classList.remove('warn');
      msg.textContent = `Matched “${p.texts[0]}” (keyword matching stands in for the VLM).`;
      this.steer(key, txt);
    }

    _alphabet() {
      const box = this.el('pg-alpha'); U.clear(box);
      const T = TASKS[this.task];
      this.alphaEls = {};
      // in the order the task usually visits them; transition frames last
      const order = T.order;
      const byId = {}; this.G.alphabet.forEach(a => { byId[a.id] = a; });
      order.filter(id => byId[id]).forEach(id => this._symbol(box, 'c' + id, `${T.dir}/${byId[id].thumb}`, T.symbols[id]));
    }
    _symbol(box, key, src, text, cls) {
      const f = U.el('figure', { class: cls || '' }, box);
      U.el('img', { src, alt: `${key}: ${text}`, loading: 'lazy', width: 52, height: 52 }, f);
      const c = U.el('figcaption', null, f);
      U.el('b', { text: key.replace(/^c3a$/, 'c3ₐ').replace(/^c3b$/, 'c3ᵦ') }, c);
      U.el('span', { text: text }, c);
      this.alphaEls[key] = f;
      return f;
    }
    _alphabetSplit(on) {
      const box = this.el('pg-alpha');
      box.querySelectorAll('.splitfig').forEach(n => n.remove());
      if (!on) { if (this.alphaEls.c3) this.alphaEls.c3.hidden = false; return; }
      const T = TASKS[this.task];
      this.alphaEls.c3.hidden = true;
      let anchor = this.alphaEls.c3;
      Object.entries(T.split).forEach(([k, d]) => {
        const f = this._symbol(box, k, `${T.dir}/alpha_${k}.jpg`, d, 'splitfig split');
        box.insertBefore(f, anchor.nextSibling); anchor = f;
      });
    }
    _alphaState() {
      Object.values(this.alphaEls).forEach(f => f.classList.remove('forbid', 'on'));
      const p = this.prefObj();
      if (p && this.stepIdx >= 0) (p.forbid || []).forEach(k => this.alphaEls[k] && this.alphaEls[k].classList.add('forbid'));
    }
    prefObj() { return this.pref ? TASKS[this.task].prefs.find(p => p.key === this.pref) : null; }

    /* ---------- stages: base -> preference automaton -> steered, one card each ---------- */
    /* view: the card on top; reached: the furthest stage available for this preference */
    async _enterBase() {
      ++this.token;
      this.pref = null; this.P = null; this.reached = 0;
      this._pressChip('');
      this.gBase.render(baseSpec(TASKS[this.task], this.G));
      await this._goto(0);
    }

    async steer(prefKey, text) {
      const T = TASKS[this.task];
      this.pref = prefKey;
      this._pressChip(prefKey, text);
      this.P = this.G.prefs[prefKey];
      this.reached = 1;
      const fs = finalSpec(T, this.G, prefKey);
      this.finalMap = fs.map;
      this.graph.render(fs);
      this._dfa(this.prefObj());
      await this._goto(1, true);
    }

    /* show stage k (0 base, 1 preference, 2 steered); auto: advance from the preference to the steered card */
    async _goto(k, auto) {
      const my = ++this.token;
      const T = TASKS[this.task], p = this.prefObj();
      this.view = k;
      this.stepIdx = k === 0 ? -1 : k === 1 ? 0 : 3;        // which symbols are marked forbidden
      this._alphabetSplit(k > 0 && !!(p && p.split));
      this._alphaState();
      this._card(k);
      if (k === 1) {
        this.viewer.setPlaying(false);                       // the arm holds while the automaton is shown
        if (auto) {
          await U.sleep(U.reduced ? 600 : 2800);
          if (my !== this.token) return;
          this.reached = 2;
          return this._goto(2);
        }
        return;
      }
      this.mode = k === 0 ? 'base' : 'steer';
      await this.viewer.setRollouts(T.dir, k === 0 ? 'base' : this.pref, eps => this._pick(eps));
      if (my !== this.token) return;
      this.viewer.setPlaying(true);
    }

    _card(k) {
      const box = this.el('am-box'), names = ['base', 'pref', 'steer'];
      const p = this.prefObj();
      box.classList.remove('mode-base', 'mode-pref', 'mode-steer'); box.classList.add('mode-' + names[k]);
      [['pg-base', 0], ['pg-dfa', 1], ['pg-steer', 2]].forEach(([id, i]) => { const e = this.el(id); e.hidden = i !== k; if (i === k) this._pop(e); });
      this.el('am-title').textContent = ['Base policy', 'Preference automaton', 'Steered policy'][k];
      let html = '';
      if (k === 0) html = 'Learned from demonstrations; the highlighted path follows the rollout.';
      else if (k === 1) {
        const formula = this.P.ltl.replace(/G /g, '□').replace(/G\(/g, '□(').replace(/c3a/g, 'c3' + sub.a).replace(/c3b/g, 'c3ᵦ');
        html = `${p.split ? 'c3 split by peg end; ' : ''}<span class="math">LTL<sub>f</sub>: ${formula}</span>, ${p.dfaNote}`;
      } else html = 'Product with the preference automaton, action lists refilled by replay; same network weights.';
      this._explain(html);
      // the other two stages peek out below: earlier ones first (nearest on top), then later ones
      const order = [k - 1, k - 2, k + 1, k + 2].filter(i => i >= 0 && i <= 2).slice(0, 2);
      ['peek-1', 'peek-2'].forEach((id, j) => {
        const b = this.el(id), i = order[j], on = i <= this.reached;
        b.className = 'peek ' + (on ? 'st-' + names[i] : 'off');
        b.disabled = !on;
        b.dataset.k = i;
        b.textContent = ['Base policy', 'Preference automaton', 'Steered policy'][i];
        b.setAttribute('aria-label', on ? `Show ${b.textContent.toLowerCase()}` : `${b.textContent} (not reached)`);
      });
    }

    _explain(html) { this.el('pg-explain').innerHTML = html; }

    _pop(el) {
      if (U.reduced || !el) return;
      el.classList.remove('pop'); void el.getBoundingClientRect(); el.classList.add('pop');
    }
    _dfa(p) {
      const box = this.el('pg-dfa'); U.clear(box);
      if (!p) return;
      const P = this.P;
      let states, acc, delta;
      if (P.dfa) { ({ states, accepting: acc } = P.dfa); delta = P.dfa.delta.map(([s, x, d]) => [s, 'c' + x, d]); }
      else {
        states = ['qA']; acc = ['qA'];
        const syms = this.G.sigma.filter(x => x !== 3).map(x => 'c' + x).concat([p.forbid[0] === 'c3b' ? 'c3a' : 'c3b']);
        delta = syms.map(x => ['qA', x, 'qA']);
      }
      const W = 460, r = 24, y = 118;
      const vw = states.length === 1 ? 300 : W;              // a one-state automaton is drawn larger
      const svg = U.svg('svg', { viewBox: `${(W - vw) / 2} 30 ${vw} 130`, role: 'img', 'aria-label': 'Preference automaton' }, box);
      svg.classList.add('pmm');
      const defs = U.svg('defs', null, svg);
      const m = U.svg('marker', { id: 'dfa-ar', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, defs);
      U.svg('path', { d: 'M0 1.2 9 5 0 8.8z', class: 'mk-hot' }, m);
      const xs = states.map((s, i) => states.length === 1 ? W / 2 : 70 + i * ((W - 140) / (states.length - 1)));
      const groups = {};
      delta.forEach(([s, x, d]) => { const k = s + '>' + d; (groups[k] = groups[k] || []).push(x); });
      const style = { stroke: 'var(--acc)', 'stroke-width': 1.6, fill: 'none' };
      const lab = { 'text-anchor': 'middle', 'font-family': 'var(--serif)', 'font-size': 14, fill: 'var(--acc-ink)' };
      Object.entries(groups).forEach(([k, xsyms]) => {
        const [s, d] = k.split('>'); const i = states.indexOf(s), j = states.indexOf(d);
        const label = PMMGraph.symList(xsyms).replace(/c3a/g, 'c3' + sub.a).replace(/c3b/g, 'c3ᵦ');
        if (s === d) {
          U.svg('path', Object.assign({ d: `M${xs[i] - 12} ${y - r + 3} C ${xs[i] - 32} ${y - 76}, ${xs[i] + 32} ${y - 76}, ${xs[i] + 12} ${y - r + 3}`, 'marker-end': 'url(#dfa-ar)' }, style), svg);
          U.svg('text', Object.assign({ x: xs[i], y: y - 70, text: label }, lab), svg);
        } else {
          U.svg('path', Object.assign({ d: `M${xs[i] + r} ${y} L ${xs[j] - r - 2} ${y}`, 'marker-end': 'url(#dfa-ar)' }, style), svg);
          U.svg('text', Object.assign({ x: (xs[i] + xs[j]) / 2, y: y + 24, text: label }, lab), svg);
        }
      });
      states.forEach((s, i) => {
        U.svg('circle', { cx: xs[i], cy: y, r, fill: 'var(--paper)', stroke: 'var(--acc)', 'stroke-width': 1.7 }, svg);
        if (acc.includes(s)) U.svg('circle', { cx: xs[i], cy: y, r: r - 5, fill: 'none', stroke: 'var(--acc)', 'stroke-width': 1.2 }, svg);
        const nm = s === 'qA' ? 's' + sub.a : 's' + String.fromCharCode(0x2080 + states.indexOf(s));
        U.svg('text', Object.assign({}, lab, { x: xs[i], y: y + 5, 'font-style': 'italic', 'font-size': 15, text: nm }), svg);
      });
    }

    /* ---------- rollouts ---------- */
    _classify(ep) {
      const T = TASKS[this.task];
      const rule = T.outcome[this.mode === 'base' ? 'base' : this.pref] || {};
      if (!ep.success) return 'fail';
      return rule[ep.outcome] || 'ok';
    }
    /* one recorded episode per task and mode, looped: a fixed one where set, else the first that succeeds
       (and, when steered, keeps the preference) */
    _pick(eps) {
      const T = TASKS[this.task];
      if (this.mode === 'base' && T.basePick != null) { const i = eps.findIndex(e => e.k === T.basePick); if (i >= 0) return i; }
      const ok = eps.findIndex(e => this._classify(e) === 'ok');
      return ok >= 0 ? ok : Math.max(0, eps.findIndex(e => e.success));
    }

    _onViewer(type, p) {
      const T = TASKS[this.task];
      if (type === 'episode') {
        const hud = this.el('stage-play').querySelector('.hud'); U.clear(hud);
        (this.mode === 'base' ? this.gBase : this.graph).resetTrail();
        U.el('span', { class: 'tag', text: this.mode === 'base' ? 'Base' : 'Steered' }, hud);
        if (this.mode !== 'base') {
          const c = this._classify(p);
          const t = U.el('span', { class: 'tag', text: (c === 'ok' ? '✓ ' : c === 'viol' ? '✗ ' : '') + (T.outText[p.success ? p.outcome : 'fail'] || p.outcome) }, hud);
          t.style.color = c === 'viol' ? 'var(--red-6)' : c === 'ok' ? 'var(--olive-7)' : '';
        }
      } else if (type === 'step') {
        const q = p.ep.q[p.step], x = p.ep.x[p.step];
        if (q === undefined) return;
        const live = this.mode === 'base' || this.stepIdx === 3;
        if (!live) return;
        const key = this.mode === 'base' ? String(q) : (this.finalMap ? this.finalMap(q) : undefined);
        if (key !== undefined) (this.mode === 'base' ? this.gBase : this.graph).highlight(key);
        const pf = this.prefObj();
        let symKey = 'c' + x;
        if (pf && pf.split && x === 3 && this.alphaEls.c3a) symKey = pf.forbid[0] === 'c3b' ? 'c3a' : 'c3b';
        Object.entries(this.alphaEls || {}).forEach(([k, f]) => f.classList.toggle('on', k === symKey));
      }
    }
  }

  window.Playground = Playground;
  window.PLAY_TASKS = TASKS;
  window.PLAY_SPECS = { baseSpec, finalSpec };
})();
