/* Rollout viewers: rebuild ManiSkill scenes in three.js and replay recorded body poses.
   Poses are SAPIEN world poses (z-up, quaternion wxyz); a root group turns z-up into y-up.

   Performance model
   - One shared, offscreen WebGLRenderer for every viewer on the page (one GL context, shaders
     compiled once, geometry uploaded once). Each viewer renders into a scissored corner of the
     shared buffer and copies it to its own 2D canvas.
   - Scene geometry, materials and decoded rollouts are cached per dataset and shared.
   - One requestAnimationFrame loop drives all viewers; a viewer draws only while visible, at
     most 30 fps while replaying (full rate while the user is orbiting), and stops when idle. */
(function () {
  const PRESET = {
    stack: { eye: [1.32, -1.12, 1.06], target: [-0.26, 0.0, 0.19], fov: 28, sps: 7 },
    peg:   { eye: [1.15, -1.05, 0.78], target: [-0.18, 0.06, 0.12], fov: 28, sps: 8 },
    pusht: { eye: [0.78, -0.92, 1.34], target: [-0.26, 0.0, 0.06], fov: 30, sps: 16 },
  };
  const COL = {
    dark: '#3A4153', light: '#F3F4F7', accent: '#5C6F9E',
    red: '#C1574A', green: '#6E8C50', coral: '#D3694E', white: '#F2F1EC', tan: '#CDB68C',
    goalBlue: '#5C6F9E', goalGreen: '#798862',
  };
  const BG = '#F4F5F8';
  const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);
  const FRAME_MS = 33;

  function hex(r, g, b) { return '#' + [r, g, b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
  function styleFor(body, rgba) {
    const [r, g, b, a] = rgba;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (body.startsWith('panda')) {
      if (lum < 0.2) return { color: COL.dark, rough: 0.5, metal: 0.15 };
      if (b > 0.7 && r < 0.2) return { color: COL.accent, rough: 0.5 };
      if ((r > 0.95 && g < 0.1) || (g > 0.95 && r < 0.1)) return { color: COL.dark, rough: 0.5 };
      return { color: COL.light, rough: 0.42 };
    }
    if (body === 'cubeA') return { color: COL.red, rough: 0.55 };
    if (body === 'cubeB') return { color: COL.green, rough: 0.55 };
    if (body.startsWith('peg')) return r > 0.7 && g < 0.4 ? { color: COL.coral, rough: 0.5 } : { color: COL.white, rough: 0.5 };
    if (body.startsWith('box')) return { color: COL.tan, rough: 0.7 };
    if (body === 'Tee' || body === 'tee') return { color: COL.red, rough: 0.55 };
    if (body.startsWith('pos1')) return { color: COL.goalBlue, rough: 0.9, opacity: 0.42 };
    if (body.startsWith('pos2')) return { color: COL.goalGreen, rough: 0.9, opacity: 0.45 };
    return { color: hex(r, g, b), rough: 0.6, opacity: a < 0.99 ? a : undefined };
  }

  /* ---------------- shared GL state ---------------- */
  const GL = { R: null, canvas: null, bufW: 0, bufH: 0, viewers: new Set(), raf: 0,
               mats: new Map(), assets: new Map(), rolls: new Map(), shared: null };

  function renderer() {
    if (GL.R) return GL.R;
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;  // hex colors are sRGB
    GL.canvas = document.createElement('canvas');
    const R = new THREE.WebGLRenderer({ canvas: GL.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    R.setPixelRatio(1);
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFShadowMap;
    R.outputEncoding = THREE.sRGBEncoding;
    R.setScissorTest(true);
    GL.canvas.addEventListener('webglcontextlost', e => e.preventDefault());
    GL.R = R;
    return R;
  }
  function ensureBuffer(w, h) {
    if (w <= GL.bufW && h <= GL.bufH) return;
    GL.bufW = Math.max(w, GL.bufW); GL.bufH = Math.max(h, GL.bufH);
    GL.R.setSize(GL.bufW, GL.bufH, false);
  }
  function shared() {
    if (GL.shared) return GL.shared;
    const grid = new THREE.GridHelper(4, 40, 0xd5dae3, 0xdde1e8);
    grid.material.transparent = true; grid.material.opacity = 0.55;
    GL.shared = {
      groundGeo: new THREE.CircleGeometry(4, 48),
      groundMat: new THREE.MeshStandardMaterial({ color: '#E6E9EF', roughness: 1 }),
      gridGeo: grid.geometry, gridMat: grid.material,
    };
    return GL.shared;
  }
  function material(st, flat) {
    const key = [st.color, st.rough, st.metal || 0, st.opacity ?? 1, flat ? 1 : 0].join('|');
    if (!GL.mats.has(key)) GL.mats.set(key, new THREE.MeshStandardMaterial({
      color: st.color, roughness: st.rough ?? 0.6, metalness: st.metal ?? 0,
      transparent: st.opacity !== undefined, opacity: st.opacity ?? 1, depthWrite: st.opacity === undefined,
      side: flat ? THREE.FrontSide : THREE.DoubleSide,
    }));
    return GL.mats.get(key);
  }

  /* scene geometry, built once per dataset */
  function sceneAssets(dir) {
    if (!GL.assets.has(dir)) GL.assets.set(dir, Promise.all([U.json(dir + '/scene.json'), U.b64(dir + '/scene.b64.txt'), U.loadThree()])
      .then(([meta, buf]) => ({
        bodies: meta.bodies.map(b => ({
          name: b.name,
          parts: b.meshes.map(m => {
            const pos = new Float32Array(buf, m.pos[0], m.pos[1] * 3);
            const idx = m.idx[2] === 'u16' ? new Uint16Array(buf, m.idx[0], m.idx[1]) : new Uint32Array(buf, m.idx[0], m.idx[1]);
            let geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            geo.setIndex(new THREE.BufferAttribute(idx, 1));
            if (m.flat) geo = geo.toNonIndexed();
            geo.computeVertexNormals();
            geo.computeBoundingSphere();
            const st = styleFor(b.name, m.color);
            return { geo, mat: material(st, m.flat), cast: st.opacity === undefined };
          }),
        })),
      })));
    return GL.assets.get(dir);
  }

  /* recorded rollouts, decoded once per file: int16 -> float32 (0.1 mm positions, quaternion / 32767) */
  function rollouts(dir, name) {
    const key = dir + '/' + name;
    if (!GL.rolls.has(key)) GL.rolls.set(key, Promise.all([U.json(`${dir}/roll_${name}.json`), U.b64(`${dir}/roll_${name}.b64.txt`)])
      .then(([meta, buf]) => {
        const q16 = new Int16Array(buf), data = new Float32Array(q16.length);
        const ps = meta.pscale, qs = meta.qscale;
        for (let i = 0; i < q16.length; i += 7) {
          data[i] = q16[i] * ps; data[i + 1] = q16[i + 1] * ps; data[i + 2] = q16[i + 2] * ps;
          data[i + 3] = q16[i + 3] * qs; data[i + 4] = q16[i + 4] * qs; data[i + 5] = q16[i + 5] * qs; data[i + 6] = q16[i + 6] * qs;
        }
        const B = meta.bodies.length;
        let off = 0;
        const all = meta.episodes.map((e, k) => { const frames = e.T + 1; const ep = Object.assign({ k, off, frames }, e); off += frames * B * 7; return ep; });
        /* every recorded trial is kept; successful ones play first */
        const eps = all.filter(e => e.success).concat(all.filter(e => !e.success));
        eps.forEach((e, i) => { e.i = i; });
        return { meta, data, B, eps };
      }));
    return GL.rolls.get(key);
  }

  /* lights + ground shared by every stage scene (identical setup keeps one shader variant) */
  function stageScene() {
    const S = new THREE.Scene();
    S.background = new THREE.Color(BG);
    S.fog = new THREE.Fog(BG, 2.2, 4.4);
    S.add(new THREE.HemisphereLight(0xffffff, 0xb8bfcc, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(1.2, 2.2, 0.9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -1.0; sc.right = 1.0; sc.top = 1.0; sc.bottom = -1.0; sc.near = 0.5; sc.far = 5;
    key.shadow.bias = -0.0005;
    S.add(key);
    const fill = new THREE.DirectionalLight(0xdfe5f3, 0.28);
    fill.position.set(-1.5, 1.0, -1.2);
    S.add(fill);
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    S.add(root);
    const sh = shared();
    const ground = new THREE.Mesh(sh.groundGeo, sh.groundMat);
    ground.receiveShadow = true;
    root.add(ground);
    const grid = new THREE.LineSegments(sh.gridGeo, sh.gridMat);
    grid.rotation.x = Math.PI / 2; grid.position.z = 0.0005;
    root.add(grid);
    return { S, root };
  }

  /* compile shaders and upload geometry ahead of time, during idle */
  async function prewarm(dir) {
    const A = await sceneAssets(dir);
    await U.idleP(1500);
    const R = renderer();
    const { S, root } = stageScene();
    A.bodies.forEach(b => b.parts.forEach(p => { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = p.cast; m.receiveShadow = true; root.add(m); }));
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), new THREE.LineBasicMaterial({ color: '#5C6F9E', transparent: true, opacity: 0.85 }));
    root.add(line);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.02, 20); cam.position.set(1, 1, 1); cam.lookAt(0, 0, 0);
    R.compile(S, cam);
    ensureBuffer(64, 64);
    R.setViewport(0, 0, 64, 64); R.setScissor(0, 0, 64, 64);
    R.render(S, cam);
  }

  function schedule() { if (!GL.raf) GL.raf = requestAnimationFrame(loop); }
  function loop(now) {
    GL.raf = 0;
    let again = false;
    GL.viewers.forEach(v => { if (v._frame(now)) again = true; });
    if (again) schedule();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });

  /* ---------------- viewer ---------------- */
  class Viewer {
    constructor(stage, opts = {}) {
      this.stage = stage;
      this.canvas = stage.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.loadingEl = stage.querySelector('.loading');
      this.opts = Object.assign({ trail: '#5C6F9E', autoAdvance: true }, opts);
      this.visible = false; this.playing = true; this.listeners = [];
      this.groups = new Map(); this._dirty = true; this._lastDraw = 0; this._interacting = false;
      this.cw = 0; this.ch = 0;
      this.ready = U.loadThree().then(() => this._init());
    }

    _init() {
      renderer();
      const { S, root } = stageScene();
      this.S = S; this.root = root;
      this.cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.02, 20);
      const ctl = new THREE.OrbitControls(this.cam, this.canvas);
      Object.assign(ctl, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 0.45, maxDistance: 2.4,
        maxPolarAngle: Math.PI * 0.47, rotateSpeed: 0.7, zoomSpeed: 0.6 });
      ctl.addEventListener('start', () => { this._interacting = true; this._kick(); });
      ctl.addEventListener('end', () => { this._interacting = false; this._kick(); });
      ctl.addEventListener('change', () => { this._dirty = true; this._kick(); });
      this.ctl = ctl;
      // end-effector trail, filled incrementally
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 1200), 3));
      tg.setDrawRange(0, 0);
      this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: this.opts.trail, transparent: true, opacity: 0.85 }));
      this.trail.frustumCulled = false;
      root.add(this.trail);
      this._q0 = new THREE.Quaternion(); this._q1 = new THREE.Quaternion();
      new ResizeObserver(() => this._resize()).observe(this.stage);
      U.watchVisible(this.stage, v => { this.visible = v; if (v) { this._dirty = true; this._kick(); } }, '80px');
      this._resize();
      GL.viewers.add(this);
    }

    _resize() {
      const dpr = DPR();
      const w = Math.round(this.stage.clientWidth * dpr), h = Math.round(this.stage.clientHeight * dpr);
      if (!w || !h || (w === this.cw && h === this.ch)) return;
      this.cw = w; this.ch = h;
      this.canvas.width = w; this.canvas.height = h;
      if (this.cam) { this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
      this._dirty = true; this._kick();
    }

    setCamera(task) {
      const p = Object.assign({}, PRESET[task] || PRESET.stack, this.opts.cam || {});
      const v = a => new THREE.Vector3(a[0], a[2], -a[1]);
      this.cam.fov = p.fov;
      this.cam.position.copy(v(p.eye));
      this.ctl.target.copy(v(p.target));
      this.cam.updateProjectionMatrix();
      this.ctl.update();
      this.sps = p.sps;
    }

    async loadScene(dir, task) {
      await this.ready;
      this.task = task;
      if (!this.groups.has(dir)) {
        const A = await sceneAssets(dir);
        const grp = new THREE.Group(), bodies = {};
        A.bodies.forEach(b => {
          const g = new THREE.Group();
          b.parts.forEach(p => { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = p.cast; m.receiveShadow = true; g.add(m); });
          grp.add(g); bodies[b.name] = g;
        });
        this.groups.set(dir, { grp, bodies });
      }
      const { grp, bodies } = this.groups.get(dir);
      if (this.bodyGroup && this.bodyGroup !== grp) this.root.remove(this.bodyGroup);
      this.root.add(grp);
      this.bodyGroup = grp; this.bodies = bodies;
      this.setCamera(task);
      if (this.loadingEl) this.loadingEl.hidden = true;
      this._dirty = true; this._kick();
    }

    /* pick(eps) -> index of the one episode to loop; without it every episode plays in turn */
    async setRollouts(dir, name, pick) {
      await this.ready;
      const r = await rollouts(dir, name);
      this.eps = pick ? [r.eps[Math.max(0, pick(r.eps))]] : r.eps;
      this.data = r.data; this.B = r.B;
      this.order = r.meta.bodies.map(n => this.bodies[n] || null);
      this.tcpIndex = r.meta.bodies.indexOf('panda_hand_tcp');
      this.rollName = name;
      this.play(0);
    }

    play(i) {
      if (!this.eps) return;
      this.epIdx = ((i % this.eps.length) + this.eps.length) % this.eps.length;
      this.t = 0; this.hold = 0; this._lastStep = -1; this._trailN = 0;
      this.trail.geometry.setDrawRange(0, 0);
      this._emit('episode', this.eps[this.epIdx]);
      this._applyFrame(0);
      this._kick();
    }

    on(fn) { this.listeners.push(fn); }
    _emit(type, payload) { this.listeners.forEach(f => f(type, payload, this)); }
    setPlaying(p) { this.playing = p; this._kick(); }
    _kick() { this._prev = 0; schedule(); }

    _applyFrame(f) {
      const ep = this.eps[this.epIdx];
      const f0 = Math.min(Math.floor(f), ep.frames - 1), f1 = Math.min(f0 + 1, ep.frames - 1), a = f - f0;
      const D = this.data, B = this.B, q0 = this._q0, q1 = this._q1;
      for (let k = 0; k < B; k++) {
        const g = this.order[k];
        if (!g) continue;
        const i0 = ep.off + (f0 * B + k) * 7, i1 = ep.off + (f1 * B + k) * 7;
        g.position.set(D[i0] + (D[i1] - D[i0]) * a, D[i0 + 1] + (D[i1 + 1] - D[i0 + 1]) * a, D[i0 + 2] + (D[i1 + 2] - D[i0 + 2]) * a);
        q0.set(D[i0 + 4], D[i0 + 5], D[i0 + 6], D[i0 + 3]);
        q1.set(D[i1 + 4], D[i1 + 5], D[i1 + 6], D[i1 + 3]);
        g.quaternion.copy(q0).slerp(q1, a);
      }
      if (this.tcpIndex >= 0) {
        const attr = this.trail.geometry.attributes.position, arr = attr.array;
        const n = Math.min(f0, 1198);
        for (let s = this._trailN; s <= n; s++) {
          const ii = ep.off + (s * B + this.tcpIndex) * 7;
          arr[s * 3] = D[ii]; arr[s * 3 + 1] = D[ii + 1]; arr[s * 3 + 2] = D[ii + 2];
        }
        // last vertex follows the interpolated end effector
        const ia = ep.off + (f0 * B + this.tcpIndex) * 7, ib = ep.off + (f1 * B + this.tcpIndex) * 7;
        const m = n + 1;
        arr[m * 3] = D[ia] + (D[ib] - D[ia]) * a; arr[m * 3 + 1] = D[ia + 1] + (D[ib + 1] - D[ia + 1]) * a; arr[m * 3 + 2] = D[ia + 2] + (D[ib + 2] - D[ia + 2]) * a;
        this._trailN = n + 1;
        attr.needsUpdate = true;
        this.trail.geometry.setDrawRange(0, m + 1);
      }
      this._dirty = true;
      const step = Math.min(Math.floor(f), ep.T - 1);
      if (step !== this._lastStep) { this._lastStep = step; this._emit('step', { ep, step }); }
    }

    /* called by the shared loop; returns true while this viewer still needs frames */
    _frame(now) {
      if (!this.visible || document.hidden || !this.cw) return false;
      const dt = this._prev ? Math.min(0.05, (now - this._prev) / 1000) : 0;
      this._prev = now;
      let busy = false;
      if (this.eps && this.playing) {
        busy = true;
        const ep = this.eps[this.epIdx];
        if (this.t < ep.frames - 1) {
          this.t = Math.min(ep.frames - 1, this.t + dt * this.sps);
          this._applyFrame(this.t);
        } else if ((this.hold += dt) > 1.3) {
          if (this.opts.autoAdvance) { this._emit('ended', ep); this.play(this.epIdx + 1); }
          else { this.t = 0; this.hold = 0; this._trailN = 0; this._applyFrame(0); }
        }
      }
      const moving = this.ctl.update();
      const live = this._interacting || moving;
      if (this._dirty && (live || now - this._lastDraw >= FRAME_MS)) { this._draw(); this._lastDraw = now; }
      return busy || live || this._dirty;
    }

    _draw() {
      const R = GL.R, w = this.cw, h = this.ch;
      ensureBuffer(w, h);
      R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h);
      R.render(this.S, this.cam);
      this.ctx.drawImage(GL.canvas, 0, GL.bufH - h, w, h, 0, 0, w, h);
      this._dirty = false;
    }
  }

  Viewer.prewarm = prewarm;
  Viewer.preloadScene = dir => sceneAssets(dir);
  Viewer.preloadRollouts = (dir, names) => Promise.all(names.map(n => rollouts(dir, n)));
  window.RolloutViewer = Viewer;
  window.ROLLOUT_PRESET = PRESET;
})();
