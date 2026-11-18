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

// Evaluación: puntaje, nivel y bono propuestos en vivo (misma fórmula que el servidor).
const ev = document.querySelector('[data-eval]');
if (ev) {
  const bonos = JSON.parse(ev.dataset.bonos || '{}');
  const LV = [['oro', 'Oro · Excelencia', 90, '#c9a24a'], ['plata', 'Plata · Destacado', 80, '#8e9aa6'], ['bronce', 'Bronce · Confiable', 70, '#b0723e'], ['base', 'En desarrollo', 0, '#5d6874']];
  const ring = ev.querySelector('[data-ring]'), out = ev.querySelector('[data-score]'), lvl = ev.querySelector('[data-level]'), bono = ev.querySelector('[data-bono]'), gate = ev.querySelector('[data-gate]');
  let shown = 0;
  const upd = () => {
    let score = 0, n = 0, seg = 0;
    ev.querySelectorAll('fieldset[data-k]').forEach((f) => {
      const v = +(f.querySelector('input:checked')?.value || 0); if (v) n++;
      if (f.dataset.k === 's_seg') seg = v;
      score += (v / 5) * +f.dataset.w;
      ev.querySelector(`[data-mini="${f.dataset.k}"] i`).style.setProperty('--v', v * 20 + '%');
    });
    score = Math.round(score * 10) / 10;
    const l = seg && seg < 3 ? LV[3] : LV.find((x) => score >= x[2]);
    ring.style.setProperty('--p', score); ring.style.setProperty('--lc', l[3]);
    gate.hidden = !(seg && seg < 3);
    lvl.textContent = n < 6 ? `Faltan ${6 - n} criterios` : l[1];
    bono.textContent = n === 6 && bonos[l[0]] ? `Bono propuesto: S/ ${bonos[l[0]]}` : n === 6 ? 'Sin bono' : '';
    const from = shown, t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 500); out.textContent = Math.round(from + (score - from) * p); if (p < 1) requestAnimationFrame(step); else shown = score; };
    requestAnimationFrame(step);
  };
  ev.addEventListener('change', upd); upd();
}

// Tarjetas que se inclinan con el mouse.
if (matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) document.querySelectorAll('.w-card').forEach((c) => {
  c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 8 + 'deg'); c.style.setProperty('--rx', (.5 - (e.clientY - r.top) / r.height) * 8 + 'deg'); });
  c.addEventListener('pointerleave', () => { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); });
});
