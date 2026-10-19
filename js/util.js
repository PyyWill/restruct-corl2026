/* Shared helpers: data loading, SVG construction, viewport triggers. */
(function () {
  const cache = new Map();
  const U = {};

  U.json = url => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }));
    return cache.get(url);
  };
  U.bin = url => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); }));
    return cache.get(url);
  };

  /* base64 text file -> ArrayBuffer (binary data ships as text so every host serves it) */
  U.b64 = url => {
    if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.text(); }).then(t => {
      t = t.trim();
      if (Uint8Array.fromBase64) return Uint8Array.fromBase64(t).buffer;
      const s = atob(t), n = s.length, out = new Uint8Array(n);
      for (let i = 0; i < n; i++) out[i] = s.charCodeAt(i);
      return out.buffer;
    }));
    return cache.get(url);
  };

  /* scripts and idle work */
  U.loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = false; s.crossOrigin = 'anonymous';
    s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
  const THREE_SRC = ['https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js',
                     'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js'];
  let threeP = null;
  U.loadThree = () => threeP || (threeP = (window.THREE && THREE.OrbitControls) ? Promise.resolve()
    : U.loadScript(THREE_SRC[0]).then(() => U.loadScript(THREE_SRC[1])));
  U.idle = (fn, timeout = 2500) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 300));
  U.idleP = (timeout) => new Promise(r => U.idle(r, timeout));

  const SVGNS = 'http://www.w3.org/2000/svg';
  U.svg = (tag, attrs, parent) => {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  U.el = (tag, attrs, parent) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  };
  U.clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };

  U.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  U.ease = t => 1 - Math.pow(1 - t, 3);
  U.easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.sleep = ms => new Promise(r => setTimeout(r, ms));

  /* animate(duration, fn(t)) -> promise; fn receives eased progress 0..1 */
  U.animate = (ms, fn, ease = U.ease) => new Promise(res => {
    if (U.reduced || ms <= 0) { fn(1); return res(); }
    const t0 = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - t0) / ms);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(tick); else res();
    };
    requestAnimationFrame(tick);
  });

  /* run cb once when element is (about to be) visible */
  /* viewport tracking; margin is px (number) or a CSS rootMargin string */
  const rm = m => (typeof m === 'number' ? `${m}px 0px ${m}px 0px` : m);
  U.onVisible = (el, cb, margin = '0px 0px -10% 0px') => {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { io.disconnect(); cb(true); }
    }, { rootMargin: rm(margin) });
    io.observe(el);
  };
  U.watchVisible = (el, cb, margin = 120) => {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), { rootMargin: rm(margin) });
    io.observe(el);
  };

  U.countUp = el => {
    const target = parseFloat(el.dataset.count);
    const dec = (el.dataset.count.split('.')[1] || '').length;
    if (U.reduced) { el.textContent = target.toFixed(dec); return; }
    el.textContent = (0).toFixed(dec);
    U.animate(1100, t => { el.textContent = (target * t).toFixed(dec); });
  };

  const tip = () => document.getElementById('tip');
  U.showTip = (evt, nodes) => {
    const t = tip(); U.clear(t);
    nodes.forEach(n => t.appendChild(n));
    const x = evt.clientX, y = evt.clientY;
    t.classList.add('on');
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    t.style.left = left + 'px'; t.style.top = top + 'px';
  };
  U.hideTip = () => tip().classList.remove('on');
  U.line = (strong, rest) => {
    const d = document.createElement('div');
    if (strong) { const b = document.createElement('b'); b.textContent = strong; d.appendChild(b); }
    if (rest) d.appendChild(document.createTextNode((strong ? ' ' : '') + rest));
    return d;
  };

  window.U = U;
})();
