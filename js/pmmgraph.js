/* Small SVG renderer for state-machine skeletons: nodes, grouped edge labels, self-loops,
   live node highlight, pruning states, and replay particles. */
(function () {
  let uid = 0;

  function symList(syms) {
    // ["c0","c2","c3","c4"] -> "c0, c2–c4"
    const nums = [], other = [];
    syms.forEach(s => { const m = /^c(\d+)$/.exec(s); if (m) nums.push(+m[1]); else other.push(s); });
    nums.sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < nums.length;) {
      let j = i;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      parts.push(j - i >= 2 ? `c${nums[i]}–c${nums[j]}` : nums.slice(i, j + 1).map(n => 'c' + n).join(', '));
      i = j + 1;
    }
    return parts.concat(other).join(', ');
  }

  class PMMGraph {
    constructor(host, opts = {}) {
      this.o = Object.assign({ w: 460, h: 220, r: 13, font: 12, loopUp: null, labelSize: 10.5 }, opts);
      this.id = 'g' + (++uid);
      if (host.tagName && host.tagName.toLowerCase() === 'svg') { this.svg = host; U.clear(host); }
      else { U.clear(host); this.svg = U.svg('svg', { role: 'img' }, host); }
      this.svg.setAttribute('viewBox', `0 0 ${this.o.w} ${this.o.h}`);
      this.svg.classList.add('pmm');
      const defs = U.svg('defs', null, this.svg);
      const mk = (id, cls) => {
        const m = U.svg('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, defs);
        U.svg('path', { d: 'M0 1.2 9 5 0 8.8z', class: cls }, m);
      };
      mk(this.id + 'a', 'mk');
      mk(this.id + 'h', 'mk-hot');
      mk(this.id + 'c', 'mk-cut');
      this.gBands = U.svg('g', null, this.svg);
      this.gEdges = U.svg('g', null, this.svg);
      this.gNodes = U.svg('g', null, this.svg);
      this.gFx = U.svg('g', null, this.svg);
      this.nodes = {}; this.edges = {};
    }

    /* spec: { nodes: [{id, x, y, label, acc, loop: 'up'|'down'}], edges: [{s, d, label, bend}], bands: [{y, h, label}] } */
    render(spec) {
      U.clear(this.gBands); U.clear(this.gEdges); U.clear(this.gNodes); U.clear(this.gFx);
      this.nodes = {}; this.edges = {};
      this.spec = spec;
      const r = this.o.r;
      (spec.bands || []).forEach(b => {
        const g = U.svg('g', { class: 'g-band' + (b.acc ? ' acc' : '') }, this.gBands);
        U.svg('rect', { x: 2, y: b.y, width: this.o.w - 4, height: b.h, rx: 8 }, g);
        U.svg('text', { x: 10, y: b.y + 14, text: b.label }, g);
      });
      const pos = {};
      spec.nodes.forEach(n => { pos[n.id] = n; });
      const cx = spec.nodes.reduce((a, n) => a + n.x, 0) / spec.nodes.length;
      const cy = spec.nodes.reduce((a, n) => a + n.y, 0) / spec.nodes.length;
      // group edges by (s,d)
      const groups = new Map();
      spec.edges.forEach(e => {
        const k = e.s + '>' + e.d;
        if (!groups.has(k)) groups.set(k, { s: e.s, d: e.d, labels: [], bend: e.bend });
        String(e.label).split(',').forEach(l => { l = l.trim(); if (l && !groups.get(k).labels.includes(l)) groups.get(k).labels.push(l); });
      });
      for (const [k, e] of groups) {
        const a = pos[e.s], b = pos[e.d];
        if (!a || !b) continue;
        const g = U.svg('g', { class: 'g-edge' }, this.gEdges);
        const label = symList(e.labels);
        let d, lx, ly;
        if (e.s === e.d) {
          const up = a.loop ? a.loop === 'up' : this.o.loopUp !== null ? this.o.loopUp(a) : (a.y <= cy + 4);
          const s = up ? -1 : 1;
          const y0 = a.y + s * r * 0.75;
          d = `M${a.x - r * 0.62} ${y0} C ${a.x - r * 1.5} ${a.y + s * r * 2.9}, ${a.x + r * 1.5} ${a.y + s * r * 2.9}, ${a.x + r * 0.62} ${y0}`;
          lx = a.x; ly = a.y + s * (r * 2.75) + (up ? -3 : 11);
        } else {
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
          const ux = dx / L, uy = dy / L;
          const rev = groups.has(e.d + '>' + e.s);
          const bend = e.bend !== undefined && e.bend !== null ? e.bend : (rev ? 13 : 0);
          const nx = -uy, ny = ux;
          const sx = a.x + ux * r, sy = a.y + uy * r, tx = b.x - ux * (r + 2), ty = b.y - uy * (r + 2);
          const mx = (sx + tx) / 2 + nx * bend, my = (sy + ty) / 2 + ny * bend;
          if (bend) {
            const ang = Math.atan2(my - a.y, mx - a.x), ang2 = Math.atan2(my - b.y, mx - b.x);
            const sx2 = a.x + Math.cos(ang) * r, sy2 = a.y + Math.sin(ang) * r;
            const tx2 = b.x + Math.cos(ang2) * (r + 2), ty2 = b.y + Math.sin(ang2) * (r + 2);
            d = `M${sx2} ${sy2} Q ${mx} ${my} ${tx2} ${ty2}`;
          } else d = `M${sx} ${sy} L ${tx} ${ty}`;
          lx = (sx + tx) / 2 + nx * (bend ? bend * 0.62 + 7 : 8);
          ly = (sy + ty) / 2 + ny * (bend ? bend * 0.62 + 7 : 8) + 3.5;
        }
        const p = U.svg('path', { d, 'marker-end': `url(#${this.id}a)` }, g);
        const t = U.svg('text', { x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': 'middle', text: label, 'font-size': this.o.labelSize }, g);
        this.edges[k] = { g, p, t, s: e.s, d: e.d, labels: e.labels };
      }
      spec.nodes.forEach(n => {
        const g = U.svg('g', { class: 'g-node' + (n.acc ? ' acc' : ''), transform: `translate(${n.x},${n.y})` }, this.gNodes);
        U.svg('circle', { class: 'halo', r: r + 5 }, g);
        U.svg('circle', { class: 'body', r }, g);
        if (n.acc) U.svg('circle', { class: 'ring', r: r - 3 }, g);
        const t = U.svg('text', { 'text-anchor': 'middle', y: 4, 'font-size': this.o.font }, g);
        const m = /^q(.*)$/.exec(n.label || '');
        if (m) { U.svg('tspan', { class: 'qq', text: 'q' }, t); U.svg('tspan', { 'font-size': this.o.font * 0.72, dy: 3, text: m[1] }, t); }
        else t.textContent = n.label || '';
        this.nodes[n.id] = { g, n };
      });
      this.current = null;
    }

    nodeClass(id, cls, on = true) { const n = this.nodes[id]; if (n) n.g.classList.toggle(cls, on); }
    edgeClass(s, d, cls, on = true) {
      const e = this.edges[s + '>' + d]; if (!e) return;
      e.g.classList.toggle(cls, on);
      this._marker(e);
    }
    _marker(e) {   // arrowhead follows the edge's state: cut (red), hot/walked/flash (accent), plain
      const c = e.g.classList;
      e.p.setAttribute('marker-end', `url(#${this.id}${(c.contains('cut') || c.contains('flag')) ? 'c' : (c.contains('hot') || c.contains('walked') || c.contains('flash') || c.contains('kept')) ? 'h' : 'a'})`);
    }
    allEdges() { return Object.values(this.edges); }
    allNodes() { return Object.values(this.nodes); }

    /* current node gets 'on'; with trail (default) every visited node and traversed edge keeps 'walked' */
    highlight(id, trail = true) {
      if (this.current === id) return;
      const prev = this.current;
      if (prev !== null && this.nodes[prev]) this.nodes[prev].g.classList.remove('on');
      if (prev !== null && this.edges[prev + '>' + id]) {
        const e = this.edges[prev + '>' + id];
        e.g.classList.add('flash'); if (trail) e.g.classList.add('walked'); this._marker(e);
        clearTimeout(e._t); e._t = setTimeout(() => { e.g.classList.remove('flash'); this._marker(e); }, 650);
      }
      this.current = id;
      if (id !== null && this.nodes[id]) { this.nodes[id].g.classList.add('on'); if (trail) this.nodes[id].g.classList.add('walked'); }
    }
    resetTrail() {
      this.allEdges().forEach(e => { e.g.classList.remove('walked', 'flash'); this._marker(e); });
      this.allNodes().forEach(n => n.g.classList.remove('walked', 'on'));
      this.current = null;
    }
    trailFrom(ids, cls = 'walked') {
      this.allEdges().forEach(e => e.g.classList.remove(cls));
      this.allNodes().forEach(n => n.g.classList.remove(cls));
      for (let i = 0; i < ids.length; i++) {
        this.nodeClass(ids[i], cls, true);
        if (i > 0) this.edgeClass(ids[i - 1], ids[i], cls, true);
      }
      this.allEdges().forEach(e => this._marker(e));
    }

    /* particles: [{path:[ids], ok:bool, failAt:index|null}] */
    particles(list, opts = {}) {
      const dur = opts.dur || 2600, stagger = opts.stagger || 34;
      const pos = {}; this.spec.nodes.forEach(n => { pos[n.id] = n; });
      const dots = list.map((p, i) => {
        const c = U.svg('circle', { r: 3.4, class: 'pt' + (p.ok ? '' : ' bad'), cx: -20, cy: -20 }, this.gFx);
        const pts = p.path.map(id => pos[id]).filter(Boolean);
        return { c, pts, p, delay: i * stagger };
      });
      if (U.reduced) { dots.forEach(d => d.c.remove()); return Promise.resolve(); }
      const t0 = performance.now();
      const total = dur + list.length * stagger + 700;
      return new Promise(res => {
        const tick = now => {
          const el = now - t0;
          dots.forEach(d => {
            const lt = (el - d.delay) / dur;
            if (lt < 0 || !d.pts.length) return;
            const segs = Math.max(1, d.pts.length - 1);
            const stopAt = d.p.ok ? 1 : Math.min(1, ((d.p.failAt ?? segs) + 0.5) / segs);
            const u = Math.min(lt, stopAt);
            const f = u * segs, i = Math.min(Math.floor(f), d.pts.length - 1), a = f - i;
            const A = d.pts[i], B = d.pts[Math.min(i + 1, d.pts.length - 1)];
            let x = A.x + (B.x - A.x) * a, y = A.y + (B.y - A.y) * a;
            if (lt >= stopAt && !d.p.ok) {
              const k = Math.min(1, (lt - stopAt) * 3);
              y += 14 * k; d.c.setAttribute('opacity', String(1 - k));
              d.c.classList.add('dead');
            } else if (lt >= 1 && d.p.ok) {
              d.c.setAttribute('opacity', String(Math.max(0, 1 - (lt - 1) * 4)));
            }
            d.c.setAttribute('cx', x.toFixed(1)); d.c.setAttribute('cy', y.toFixed(1));
          });
          if (el < total) requestAnimationFrame(tick); else { dots.forEach(d => d.c.remove()); res(); }
        };
        requestAnimationFrame(tick);
      });
    }
  }

  PMMGraph.symList = symList;
  window.PMMGraph = PMMGraph;
})();
