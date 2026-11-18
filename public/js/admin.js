// Panel: confirmaciones, modo claro/oscuro, cifras que cuentan y filas que entran en cascada.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-confirm]'); if (b && !confirm(b.dataset.confirm)) e.preventDefault();
  const more = document.querySelector('.ad-more[open]'); if (more && !more.contains(e.target)) more.open = false;
});
document.querySelectorAll('[data-theme-btn]').forEach((btn) => btn.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  const apply = () => { if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme; };
  try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* sin almacenamiento */ }
  document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(apply) : apply();
}));
document.querySelectorAll('.a-table tbody tr').forEach((tr, i) => tr.style.setProperty('--i', Math.min(i, 15)));
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('[data-count]').forEach((el) => {
  const to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now() + 300, dur = 1400;
  if (!to) return;
  const tick = (t) => { const p = Math.min(1, Math.max(0, (t - t0) / dur)); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4))).toLocaleString('es-PE') + suf; if (p < 1) requestAnimationFrame(tick); };
  el.textContent = '0' + suf; requestAnimationFrame(tick);
});
