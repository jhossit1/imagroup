// Vista previa dentro del editor: resalta secciones, avisa cuál se tocó y no deja salir de la página.
(() => {
  if (window.parent === window) return;
  const O = location.origin, send = (m) => parent.postMessage(m, O);
  document.documentElement.classList.add('pv');
  let marked = null;
  const mark = (id, scroll) => {
    document.querySelectorAll('.pv-on').forEach((x) => x.classList.remove('pv-on'));
    marked = id && document.getElementById('b-' + id);
    if (!marked) return;
    marked.classList.add('pv-on');
    if (scroll) marked.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  addEventListener('message', (e) => {
    if (e.origin !== O || !e.data) return;
    const m = e.data;
    if (m.t === 'init') {
      document.documentElement.dataset.theme = m.theme === 'dark' ? 'dark' : '';
      if (m.theme !== 'dark') delete document.documentElement.dataset.theme;
      scrollTo({ top: m.y || 0, behavior: 'instant' });
      if (m.sel) mark(m.sel, false);
    }
    if (m.t === 'theme') { if (m.v === 'dark') document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; }
    if (m.t === 'focus') mark(m.id, true);
    if (m.t === 'mark') mark(m.id, false);
  });
  // Clic en una sección: la elige en el editor. Los enlaces y formularios no navegan.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bid]');
    const nav = e.target.closest('a[href], button[type=submit], form button');
    if (nav) e.preventDefault();
    if (b) { send({ t: 'select', id: b.dataset.bid }); mark(b.dataset.bid, false); }
  }, true);
  document.addEventListener('submit', (e) => e.preventDefault(), true);
  let t; addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => send({ t: 'scroll', y: scrollY }), 80); }, { passive: true });
})();
