/* Real-robot videos: the CanSorting teaser and the CanSorting trio in the Reuse section. */
(function () {
  /* teaser: the three CanSorting videos play while on screen */
  function initTeaser() {
    const box = document.getElementById('teaser');
    if (!box) return;
    const vids = [...box.querySelectorAll('video')];
    U.watchVisible(box, v => vids.forEach(x => { if (v) x.play().catch(() => {}); else x.pause(); }), '0px');
  }

  /* Reuse: three CanSorting videos; only the selected one plays, the others hold their poster frame */
  function initCanSort() {
    const figs = [...document.querySelectorAll('#cs-trip figure')];
    let active = figs.find(f => f.classList.contains('on')) || figs[figs.length - 1];
    let visible = false;
    figs.forEach(f => {
      const v = f.querySelector('video');
      const pick = () => {
        if (active === f) return;
        active.querySelector('video').pause();
        active = f;
        figs.forEach(x => x.classList.toggle('on', x === f));
        if (visible) { v.currentTime = 0; v.play().catch(() => {}); }
      };
      f.addEventListener('mouseenter', pick);
      f.addEventListener('click', pick);
      f.addEventListener('focusin', pick);
    });
    U.watchVisible(document.getElementById('cs-trip'), on => {
      visible = on;
      const v = active.querySelector('video');
      if (on) v.play().catch(() => {}); else v.pause();
    }, '0px');
  }

  window.RealVideos = { initTeaser, initCanSort };
})();
